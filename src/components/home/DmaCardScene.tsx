"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { MARK_PATHS } from "@/components/brand/Logo";
import { roundedRect, useGrain } from "./scene-utils";

// A TraceCore DMA card, as in the product photo: black anodised cover with the printed logo over a black PCB,
// PCIe x1 gold fingers below it and a full-height black bracket with the USB-C port. 1 unit = 10 mm; the card
// lies in the XY plane facing +Z, the bracket stands at x = 0.

const PLATE = { x: 3.6, y: 0, w: 6.8, h: 4.4, t: 0.2, back: 0.14, corner: 0.22, bevel: 0.035 };
const FRONT = PLATE.back + PLATE.t;
const PCB = { front: PLATE.back - 0.02, t: 0.16 };
// PCIe x1 edge: 11 fingers, the key, then 7, at a 1 mm pitch.
const TAB = { left: 2.0, right: 4.6, top: -2.1, bottom: -2.9, keyLeft: 3.565, keyRight: 3.755, keyTop: -2.45 };
const BRACKET = { top: 5.1, bottom: -6.6, width: 1.85, t: 0.08, z: 0.15 };

/** The cover's print: the TC mark, the TRACECORELAB wordmark and the domain, drawn with the site's fonts. */
function useLabel(width: number, height: number) {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    let cancelled = false;
    const style = getComputedStyle(document.body);
    const anton = style.getPropertyValue("--font-anton").trim() || "Impact, sans-serif";
    const sans = style.getPropertyValue("--font-geist-sans").trim() || "Arial, sans-serif";
    const size = 230;
    Promise.all([document.fonts.load(`400 ${size}px ${anton}`), document.fonts.load(`600 64px ${sans}`)])
      .catch(() => null)
      .then(() => {
        if (cancelled) return;
        const c = document.createElement("canvas");
        c.width = 2048;
        c.height = Math.round((2048 * height) / width);
        const ctx = c.getContext("2d")!;

        ctx.font = `400 ${size}px ${anton}`;
        const trace = ctx.measureText("TRACECORE").width;
        const lab = ctx.measureText("LAB").width;
        const wordW = trace + lab;
        const capH = size * 0.74;
        const markH = capH * 1.22;
        const markW = (markH * 3850.96) / 2905.43;
        const gap = size * 0.32;
        const domainSize = size * 0.27;
        const lockupW = markW + gap + wordW;
        const scale = (c.width * 0.72) / lockupW;
        ctx.translate((c.width - lockupW * scale) / 2, c.height / 2);
        ctx.scale(scale, scale);

        // Mark, vertically centred on the wordmark plus the domain line.
        const blockTop = -(capH + domainSize * 1.9) / 2;
        ctx.save();
        ctx.translate(0, blockTop + (capH + domainSize * 1.9 - markH) / 2);
        ctx.scale(markH / 2905.43, markH / 2905.43);
        const flame = ctx.createLinearGradient(0, 2905, 3850, 0);
        flame.addColorStop(0, "#ff1206");
        flame.addColorStop(1, "#ff7a00");
        ctx.fillStyle = flame;
        ctx.fill(new Path2D(MARK_PATHS.wing));
        ctx.fill(new Path2D(MARK_PATHS.stem));
        const silver = ctx.createLinearGradient(1359, 0, 2729, 0);
        silver.addColorStop(0.2, "#bcbec0");
        silver.addColorStop(1, "#f1f2f2");
        ctx.fillStyle = silver;
        ctx.fill(new Path2D(MARK_PATHS.plate));
        ctx.restore();

        // Wordmark: TRACECORE in the flame gradient, LAB in silver.
        const x0 = markW + gap;
        const base = blockTop + capH;
        ctx.textBaseline = "alphabetic";
        const word = ctx.createLinearGradient(x0, 0, x0 + trace, 0);
        word.addColorStop(0, "#ff1a0a");
        word.addColorStop(1, "#ff7a00");
        ctx.fillStyle = word;
        ctx.fillText("TRACECORE", x0, base);
        const labFill = ctx.createLinearGradient(x0 + trace, 0, x0 + wordW, 0);
        labFill.addColorStop(0, "#d8d9db");
        labFill.addColorStop(1, "#f6f6f7");
        ctx.fillStyle = labFill;
        ctx.fillText("LAB", x0 + trace, base);

        // TRACECORELAB.COM, letter-spaced to the wordmark's width.
        ctx.font = `600 ${domainSize}px ${sans}`;
        const chars = [..."TRACECORELAB.COM"];
        const widths = chars.map((ch) => ctx.measureText(ch).width);
        const spacing = (wordW * 0.94 - widths.reduce((a, b) => a + b, 0)) / (chars.length - 1);
        const domain = ctx.createLinearGradient(x0, 0, x0 + wordW, 0);
        domain.addColorStop(0, "#ff3b12");
        domain.addColorStop(1, "#ff8a2a");
        ctx.fillStyle = domain;
        let x = x0 + wordW * 0.03;
        chars.forEach((ch, i) => {
          ctx.fillText(ch, x, base + domainSize * 1.55);
          x += widths[i] + spacing;
        });

        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        setTex(t);
      });
    return () => {
      cancelled = true;
    };
  }, [width, height]);

  useEffect(() => () => tex?.dispose(), [tex]);
  return tex;
}

function useCardAssets() {
  const grain = useGrain();
  const assets = useMemo(() => {
    const b = PLATE.bevel;
    const plate = new THREE.ExtrudeGeometry(roundedRect(PLATE.w - b * 2, PLATE.h - b * 2, PLATE.corner - b), {
      depth: PLATE.t - b * 2,
      bevelEnabled: true,
      bevelThickness: b,
      bevelSize: b,
      bevelSegments: 4,
      curveSegments: 16,
    });
    plate.translate(PLATE.x, PLATE.y, PLATE.back + b);

    // The board, with the edge connector and its key notch.
    const board = new THREE.Shape();
    board.moveTo(0.05, 2.1);
    board.lineTo(6.9, 2.1);
    board.lineTo(6.9, TAB.top);
    for (const [x, y] of [
      [TAB.right, TAB.top],
      [TAB.right, TAB.bottom],
      [TAB.keyRight, TAB.bottom],
      [TAB.keyRight, TAB.keyTop],
      [TAB.keyLeft, TAB.keyTop],
      [TAB.keyLeft, TAB.bottom],
      [TAB.left, TAB.bottom],
      [TAB.left, TAB.top],
      [0.05, TAB.top],
    ])
      board.lineTo(x, y);
    const pcb = new THREE.ExtrudeGeometry(board, { depth: PCB.t, bevelEnabled: false });
    pcb.translate(0, 0, PCB.front - PCB.t);

    // Gold fingers on both faces.
    const fingerXs = [
      ...Array.from({ length: 11 }, (_, i) => TAB.keyLeft - 0.08 - i * 0.1),
      ...Array.from({ length: 7 }, (_, i) => TAB.keyRight + 0.08 + i * 0.1),
    ];
    const finger = new THREE.BoxGeometry(0.065, 0.4, 0.012);
    const fingers = new THREE.InstancedMesh(finger, undefined, fingerXs.length * 2);
    const m = new THREE.Matrix4();
    fingerXs.forEach((x, i) => {
      fingers.setMatrixAt(i * 2, m.makeTranslation(x, TAB.bottom + 0.25, PCB.front + 0.006));
      fingers.setMatrixAt(i * 2 + 1, m.makeTranslation(x, TAB.bottom + 0.25, PCB.front - PCB.t - 0.006));
    });
    fingers.instanceMatrix.needsUpdate = true;

    // Bracket: the upright plate with its tongue, then the top tab bent outwards with the screw slot.
    const w = BRACKET.width / 2;
    const upright = new THREE.Shape();
    upright.moveTo(-w, BRACKET.top);
    upright.lineTo(w, BRACKET.top);
    upright.lineTo(w, -5.9);
    upright.lineTo(0.15, -5.9);
    upright.lineTo(0.15, BRACKET.bottom + 0.25);
    upright.lineTo(-0.1, BRACKET.bottom);
    upright.lineTo(-0.35, BRACKET.bottom);
    upright.lineTo(-0.6, BRACKET.bottom + 0.25);
    upright.lineTo(-0.6, -5.9);
    upright.lineTo(-w, -5.9);
    upright.lineTo(-w, BRACKET.top);
    const bracket = new THREE.ExtrudeGeometry(upright, { depth: BRACKET.t, bevelEnabled: false });
    bracket.rotateY(-Math.PI / 2);
    bracket.translate(0, 0, BRACKET.z);

    const tabShape = new THREE.Shape();
    tabShape.moveTo(0, -w);
    tabShape.lineTo(0, w);
    tabShape.lineTo(-0.95, w);
    tabShape.lineTo(-0.95, 0.2);
    tabShape.lineTo(-0.5, 0.2);
    tabShape.absarc(-0.5, 0, 0.2, Math.PI / 2, (Math.PI * 3) / 2, false);
    tabShape.lineTo(-0.95, -0.2);
    tabShape.lineTo(-0.95, -w);
    tabShape.lineTo(0, -w);
    const tab = new THREE.ExtrudeGeometry(tabShape, { depth: BRACKET.t, bevelEnabled: false });
    tab.rotateX(Math.PI / 2);
    tab.translate(0, BRACKET.top, BRACKET.z);

    // USB-C port in the bracket, its long side upright (parallel to the board).
    const portShell = new THREE.ShapeGeometry(roundedRect(0.36, 0.94, 0.16), 12);
    const portHole = new THREE.ShapeGeometry(roundedRect(0.27, 0.85, 0.12), 12);
    for (const g of [portShell, portHole]) g.rotateY(-Math.PI / 2);
    portShell.translate(-BRACKET.t - 0.002, 0.55, PCB.front + 0.2);
    portHole.translate(-BRACKET.t - 0.004, 0.55, PCB.front + 0.2);

    const anodised = new THREE.MeshPhysicalMaterial({
      color: "#0f0f11",
      metalness: 0.7,
      roughness: 0.38,
      roughnessMap: grain,
      bumpMap: grain,
      bumpScale: 0.25,
      clearcoat: 0.35,
      clearcoatRoughness: 0.35,
      envMapIntensity: 1.4,
    });
    const steel = new THREE.MeshPhysicalMaterial({ color: "#0b0b0c", metalness: 0.6, roughness: 0.48, envMapIntensity: 1.1 });
    const pcbMat = new THREE.MeshStandardMaterial({ color: "#060707", roughness: 0.55, metalness: 0.15 });
    const gold = new THREE.MeshPhysicalMaterial({ color: "#e0aa3e", metalness: 1, roughness: 0.22, envMapIntensity: 1.6 });
    fingers.material = gold;
    const chrome = new THREE.MeshStandardMaterial({ color: "#c8c9cc", metalness: 1, roughness: 0.3 });
    const hole = new THREE.MeshBasicMaterial({ color: "#020202" });
    return { plate, pcb, fingers, finger, bracket, tab, portShell, portHole, anodised, steel, pcbMat, gold, chrome, hole };
  }, [grain]);

  useEffect(
    () => () => {
      for (const v of Object.values(assets)) if ("dispose" in v && typeof v.dispose === "function") v.dispose();
    },
    [assets],
  );
  return assets;
}

const DECAL = { w: PLATE.w - 0.4, h: PLATE.h - 0.4 };

function Card({ play, pointer, hover }: { play: boolean; pointer: RefObject<{ x: number; y: number }>; hover: RefObject<boolean> }) {
  const group = useRef<THREE.Group>(null);
  const startedAt = useRef<number | null>(null);
  const intro = useRef(0);
  const lift = useRef(0);
  const a = useCardAssets();
  const label = useLabel(DECAL.w, DECAL.h);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    if (play && startedAt.current === null) startedAt.current = t;
    // Arrives a beat after the logo, swinging up into its resting pose.
    const go = startedAt.current !== null && t - startedAt.current > 0.3;
    intro.current = THREE.MathUtils.damp(intro.current, go ? 1 : 0, 2.4, delta);
    lift.current = THREE.MathUtils.damp(lift.current, hover.current ? 1 : 0, 5, delta);

    const k = intro.current;
    const h = lift.current;
    const p = pointer.current ?? { x: 0, y: 0 };
    g.position.y = (1 - k) * 7 + h * 0.2;
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -0.28 + p.y * 0.12 - (1 - k) * 1.1 + h * 0.12, 4, delta);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, -0.42 + p.x * 0.25 + Math.sin(t * 0.4) * 0.1 - (1 - k) * 2.4 + h * 0.3, 4, delta);
    g.rotation.z = 0.32;
    g.scale.setScalar(0.47 * (0.7 + 0.3 * k) * (1 + h * 0.05));
  });

  return (
    <Float speed={1.2} rotationIntensity={0.22} floatIntensity={0.5} floatingRange={[-0.12, 0.12]}>
      <group ref={group} position={[0, 7, 0]} scale={0.33}>
        {/* Centre the card + bracket on the group's origin. */}
        <group position={[-3.05, 0.75, -0.1]}>
          <mesh geometry={a.plate} material={a.anodised} />
          {label && (
            <mesh position={[PLATE.x, PLATE.y, FRONT + 0.003]}>
              <planeGeometry args={[DECAL.w, DECAL.h]} />
              <meshStandardMaterial map={label} emissiveMap={label} emissive="#ffffff" emissiveIntensity={0.45} transparent roughness={0.35} metalness={0.1} />
            </mesh>
          )}
          <mesh geometry={a.pcb} material={a.pcbMat} />
          <primitive object={a.fingers} />
          <mesh position={[2.18, -2.55, PCB.front + 0.06]}>
            <boxGeometry args={[0.24, 0.16, 0.12]} />
            <meshStandardMaterial color="#d8a92a" roughness={0.4} metalness={0.2} />
          </mesh>
          <mesh geometry={a.bracket} material={a.steel} />
          <mesh geometry={a.tab} material={a.steel} />
          <mesh geometry={a.portShell} material={a.chrome} />
          <mesh geometry={a.portHole} material={a.hole} />
        </group>
      </group>
    </Float>
  );
}

export default function DmaCardScene({ play, active, hover }: { play: boolean; active: boolean; hover: RefObject<boolean> }) {
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <Canvas
      className="!pointer-events-none"
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 0, 11], fov: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.15;
      }}
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[-3, 5, 9]} intensity={1.4} />
      <directionalLight position={[6, 2, 6]} intensity={0.7} color="#ffd2b8" />
      <pointLight position={[-5, -3, 5]} intensity={40} color="#ff3d00" />
      <Card play={play} pointer={pointer} hover={hover} />
      <Environment resolution={256} frames={1}>
        {/* soft front box for the anodised cover's sheen, warm rim from the brand orange */}
        <Lightformer form="rect" intensity={0.9} position={[2, 3, 10]} scale={[14, 8, 1]} />
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer form="circle" intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={2} />
          <Lightformer form="rect" intensity={2.2} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={[8, 2, 1]} />
          <Lightformer form="rect" intensity={1.8} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={8} />
          <Lightformer form="ring" color="#ff4d1a" intensity={7} position={[10, 10, 0]} scale={10} onUpdate={(self) => self.lookAt(0, 0, 0)} />
        </group>
      </Environment>
    </Canvas>
  );
}

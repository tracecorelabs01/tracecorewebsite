"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { seeded } from "@/lib/utils";

// Ferrum body: 64 × 44 × 9 mm slab (1 unit = 10 mm), soft rounded edges.
const W = 6.4;
const H = 4.4;
const CORNER = 0.6;
const DEPTH = 0.5;
const BEVEL = 0.2;
const TOP = DEPTH / 2 + BEVEL; // z of the flat top face
const HOLE: [number, number] = [2.05, 1.0];

// The "F" mark: two slanted bars and a wedge, inlaid in glossy black.
const F_PARTS: [number, number][][] = [
  [
    [-0.9, 1.0],
    [0.8, 1.0],
    [0.46, 0.55],
    [-1.24, 0.55],
  ],
  [
    [-0.9, 0.4],
    [0.27, 0.4],
    [-0.07, -0.05],
    [-1.24, -0.05],
  ],
  [
    [-0.9, -0.2],
    [-0.23, -0.2],
    [-1.31, -0.75],
  ],
];

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = w / 2;
  const y = h / 2;
  s.moveTo(-x + r, -y);
  s.lineTo(x - r, -y);
  s.absarc(x - r, -y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x, y - r);
  s.absarc(x - r, y - r, r, 0, Math.PI / 2, false);
  s.lineTo(-x + r, y);
  s.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-x, -y + r);
  s.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Fine random grain for the bead-blasted aluminium (used as bump + roughness map). */
function useGrain() {
  const tex = useMemo(() => {
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    const rand = seeded(64);
    for (let i = 0; i < size * size; i++) {
      const v = 140 + rand() * 115;
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(0.45, 0.45);
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

function useFerrumAssets() {
  const grain = useGrain();
  const assets = useMemo(() => {
    const body = new THREE.ExtrudeGeometry(roundedRect(W - BEVEL * 2, H - BEVEL * 2, CORNER - BEVEL), {
      depth: DEPTH,
      bevelEnabled: true,
      bevelThickness: BEVEL,
      bevelSize: BEVEL,
      bevelSegments: 10,
      curveSegments: 28,
    });
    body.translate(0, 0, -DEPTH / 2);

    const inlays = F_PARTS.map((pts) => {
      const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: 0.04,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.03,
        bevelSegments: 4,
      });
      g.translate(0, 0, TOP - 0.05);
      return g;
    });

    const port = new THREE.ShapeGeometry(roundedRect(0.22, 0.66, 0.1));

    const aluminium = new THREE.MeshPhysicalMaterial({
      color: "#77757a",
      metalness: 0.88,
      roughness: 0.44,
      roughnessMap: grain,
      bumpMap: grain,
      bumpScale: 0.35,
      clearcoat: 0.15,
      clearcoatRoughness: 0.5,
      envMapIntensity: 1.2,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: "#030304",
      metalness: 0.25,
      roughness: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.5,
    });
    return { body, inlays, port, aluminium, glass };
  }, [grain]);

  useEffect(
    () => () => {
      assets.body.dispose();
      assets.inlays.forEach((g) => g.dispose());
      assets.port.dispose();
      assets.aluminium.dispose();
      assets.glass.dispose();
    },
    [assets],
  );
  return assets;
}

function Device({ play, pointer, hover }: { play: boolean; pointer: RefObject<{ x: number; y: number }>; hover: RefObject<boolean> }) {
  const group = useRef<THREE.Group>(null);
  const led = useRef<THREE.MeshBasicMaterial>(null);
  const ledLight = useRef<THREE.PointLight>(null);
  const startedAt = useRef<number | null>(null);
  const intro = useRef(0);
  const lift = useRef(0);
  const { body, inlays, port, aluminium, glass } = useFerrumAssets();

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    if (play && startedAt.current === null) startedAt.current = t;
    // Enter a beat after the logo, rising and spinning into its resting pose.
    const go = startedAt.current !== null && t - startedAt.current > 0.55;
    intro.current = THREE.MathUtils.damp(intro.current, go ? 1 : 0, 2.4, delta);
    lift.current = THREE.MathUtils.damp(lift.current, hover.current ? 1 : 0, 5, delta);

    const k = intro.current;
    const h = lift.current;
    const p = pointer.current ?? { x: 0, y: 0 };
    g.position.y = (1 - k) * -5.5 + h * 0.15;
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -0.24 + p.y * 0.1 + (1 - k) * 1.2 + h * 0.16, 4, delta);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, 0.32 + p.x * 0.25 + Math.sin(t * 0.45) * 0.1 - (1 - k) * 2.6 - h * 0.34, 4, delta);
    g.rotation.z = 0.12;
    g.scale.setScalar((0.7 + 0.3 * k) * (1 + h * 0.05));

    const pulse = 0.5 + 0.5 * Math.sin(t * 2.6);
    if (led.current) led.current.opacity = 0.55 + 0.45 * pulse;
    if (ledLight.current) ledLight.current.intensity = 1.2 + 2.4 * pulse;
  });

  return (
    <Float speed={1.3} rotationIntensity={0.25} floatIntensity={0.55} floatingRange={[-0.1, 0.1]}>
      <group ref={group} position={[0, -5.5, 0]} scale={0.6}>
        <mesh geometry={body} material={aluminium} />
        {inlays.map((g, i) => (
          <mesh key={i} geometry={g} material={glass} />
        ))}

        {/* status LED */}
        <mesh position={[HOLE[0], HOLE[1], TOP + 0.002]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.14, 0.14, 0.01, 40]} />
          <meshStandardMaterial color="#040404" roughness={0.35} />
        </mesh>
        <mesh position={[HOLE[0], HOLE[1], TOP + 0.003]}>
          <torusGeometry args={[0.145, 0.02, 12, 48]} />
          <meshStandardMaterial color="#d6d7d9" metalness={1} roughness={0.25} />
        </mesh>
        <mesh position={[HOLE[0], HOLE[1], TOP + 0.009]}>
          <circleGeometry args={[0.075, 32]} />
          <meshBasicMaterial ref={led} color="#ff5a1f" transparent toneMapped={false} />
        </mesh>
        <pointLight ref={ledLight} position={[HOLE[0], HOLE[1], TOP + 0.45]} color="#ff4d14" distance={3} decay={2} />

        {/* USB-C port on the left edge */}
        <mesh geometry={port} position={[-W / 2 - 0.003, -0.35, 0]} rotation-y={-Math.PI / 2}>
          <meshStandardMaterial color="#050505" roughness={0.45} />
        </mesh>
      </group>
    </Float>
  );
}

export default function FerrumScene({ play, active, hover }: { play: boolean; active: boolean; hover: RefObject<boolean> }) {
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
        gl.toneMappingExposure = 1.1;
      }}
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[-3, 5, 9]} intensity={1.5} />
      <directionalLight position={[6, 1, 6]} intensity={0.8} color="#ffd2b8" />
      <pointLight position={[5, -3, 5]} intensity={45} color="#ff3d00" />
      <Device play={play} pointer={pointer} hover={hover} />
      <Environment resolution={256} frames={1}>
        {/* front softbox: gives the bead-blasted face its soft studio gradient */}
        <Lightformer form="rect" intensity={0.75} position={[-2, 3, 10]} scale={[14, 8, 1]} />
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer form="circle" intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={2} />
          <Lightformer form="rect" intensity={2.5} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={[8, 2, 1]} />
          <Lightformer form="rect" intensity={2} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={8} />
          <Lightformer form="rect" intensity={1.4} position={[-6, 6, 6]} scale={[12, 12, 1]} onUpdate={(self) => self.lookAt(0, 0, 0)} />
          <Lightformer form="ring" color="#ff4d1a" intensity={7} position={[10, 10, 0]} scale={10} onUpdate={(self) => self.lookAt(0, 0, 0)} />
        </group>
      </Environment>
    </Canvas>
  );
}

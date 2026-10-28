"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { MARK_PATHS } from "@/components/brand/Logo";

const W = 3850.96;
const H = 2905.43;
const SCALE = 1 / 1150;

/** Extrudes the three pieces of the TC mark; red→orange baked in as vertex colors. */
function useMarkGeometries() {
  const geometries = useMemo(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><path d="${MARK_PATHS.wing}"/><path d="${MARK_PATHS.stem}"/><path d="${MARK_PATHS.plate}"/></svg>`;
    const { paths } = new SVGLoader().parse(svg);
    const red = new THREE.Color("#ff1206");
    const orange = new THREE.Color("#ff7a00");
    const c = new THREE.Color();

    return paths.map((path, i) => {
      const geo = new THREE.ExtrudeGeometry(path.toShapes(), {
        depth: 360,
        bevelEnabled: true,
        bevelThickness: 46,
        bevelSize: 30,
        bevelSegments: 6,
        curveSegments: 20,
      });
      geo.translate(-W / 2, -H / 2, -180);
      if (i < 2) {
        const pos = geo.attributes.position;
        const colors = new Float32Array(pos.count * 3);
        for (let v = 0; v < pos.count; v++) {
          const t = THREE.MathUtils.clamp((pos.getX(v) + W / 2) / W + (pos.getY(v) + H / 2) / H * -0.12 + 0.06, 0, 1);
          c.copy(red).lerp(orange, t);
          colors[v * 3] = c.r;
          colors[v * 3 + 1] = c.g;
          colors[v * 3 + 2] = c.b;
        }
        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      }
      return geo;
    });
  }, []);

  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  return geometries;
}

function Mark({ play, pointer }: { play: boolean; pointer: RefObject<{ x: number; y: number }> }) {
  const group = useRef<THREE.Group>(null);
  const intro = useRef(0);
  const geometries = useMarkGeometries();

  const materials = useMemo(
    () => ({
      flame: new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        metalness: 0.42,
        roughness: 0.24,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        emissive: new THREE.Color("#ff1a00"),
        emissiveIntensity: 0.16,
      }),
      silver: new THREE.MeshPhysicalMaterial({
        color: "#f1f2f3",
        metalness: 0.62,
        roughness: 0.3,
        clearcoat: 0.8,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.6,
        emissive: new THREE.Color("#3a3b3e"),
        emissiveIntensity: 0.35,
      }),
    }),
    [],
  );
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    intro.current = THREE.MathUtils.damp(intro.current, play ? 1 : 0, 2.4, delta);
    const k = intro.current;
    const p = pointer.current ?? { x: 0, y: 0 };
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, p.x * 0.55 - (1 - k) * 2.2, 3.5, delta);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, p.y * 0.32 + (1 - k) * 0.5, 3.5, delta);
    const s = SCALE * (0.55 + 0.45 * k);
    g.scale.set(s, -s, s);
  });

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.7}>
      <group ref={group} scale={[SCALE * 0.55, -SCALE * 0.55, SCALE * 0.55]} rotation={[0.5, -2.2, 0]}>
        {geometries.map((geo, i) => (
          <mesh key={i} geometry={geo} material={i < 2 ? materials.flame : materials.silver} />
        ))}
      </group>
    </Float>
  );
}

export default function LogoScene({ play, active }: { play: boolean; active: boolean }) {
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
      camera={{ position: [0, 0, 8], fov: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.15;
      }}
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 6]} intensity={1.6} />
      <pointLight position={[-4, -2.5, 3]} intensity={40} color="#ff3d00" />
      <Mark play={play} pointer={pointer} />
      <Environment resolution={256} frames={1}>
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer form="circle" intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={2} />
          <Lightformer form="circle" intensity={2} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={2} />
          <Lightformer form="circle" intensity={2} rotation-y={Math.PI / 2} position={[-5, -1, -1]} scale={2} />
          <Lightformer form="circle" intensity={2.5} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={8} />
          <Lightformer form="ring" color="#ff4d1a" intensity={8} position={[10, 10, 0]} scale={10} onUpdate={(self) => self.lookAt(0, 0, 0)} />
        </group>
      </Environment>
    </Canvas>
  );
}

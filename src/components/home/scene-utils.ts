"use client";

// Shared by the hero's 3D product models (FerrumScene, DmaCardScene).

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { seeded } from "@/lib/utils";

/** A rounded rectangle centred on the origin, for extruding. */
export function roundedRect(w: number, h: number, r: number) {
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
export function useGrain() {
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

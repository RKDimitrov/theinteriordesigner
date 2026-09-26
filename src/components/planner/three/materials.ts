import * as THREE from "three";
import type { FloorFinish, WallFinish } from "../state";

/** Wall paint per finish. */
export const WALL_COLOR: Readonly<Record<WallFinish, string>> = {
  limewash: "#e9e1d2",
  warmwhite: "#f5efe4",
  clay: "#d9a88a",
  sage: "#b9bfa3",
};

/** Swatch backgrounds for the Finishes tab (CSS), matching the 3D textures. */
export const FLOOR_SWATCH: Readonly<Record<FloorFinish, string>> = {
  oak: "repeating-linear-gradient(0deg,rgba(80,50,25,.22) 0 1px,transparent 1px 20px),repeating-linear-gradient(90deg,transparent 0 119px,rgba(80,50,25,.14) 119px 120px),#cfa77a",
  ash: "repeating-linear-gradient(0deg,rgba(80,60,35,.14) 0 1px,transparent 1px 18px),#e6d3b3",
  terracotta: "linear-gradient(rgba(90,40,20,.3) 1px,transparent 1px) 0 0/30px 30px,linear-gradient(90deg,rgba(90,40,20,.3) 1px,transparent 1px) 0 0/30px 30px,#c07a55",
  microcement: "#cbc3b6",
};

const PX = 512; // texture pixels per metre

function draw(finish: FloorFinish, ctx: CanvasRenderingContext2D) {
  const fill = (c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, PX, PX);
  };
  switch (finish) {
    case "oak":
    case "ash": {
      fill(finish === "oak" ? "#cfa77a" : "#e6d3b3");
      const plank = finish === "oak" ? 20 : 18; // cm wide
      const rows = Math.round(100 / plank);
      const h = PX / rows;
      for (let r = 0; r < rows; r++) {
        // Slight tone change per board, staggered joints.
        ctx.fillStyle = `rgba(80,50,25,${0.03 + ((r * 37) % 7) * 0.012})`;
        ctx.fillRect(0, r * h, PX, h);
        ctx.fillStyle = "rgba(80,50,25,.28)";
        ctx.fillRect(0, r * h, PX, 1.5);
        const joint = ((r * 0.37) % 1) * PX;
        ctx.fillRect(joint, r * h, 1.5, h);
      }
      break;
    }
    case "terracotta": {
      fill("#c07a55");
      const tile = PX / 3; // 33 cm tiles
      ctx.fillStyle = "rgba(90,40,20,.35)";
      for (let i = 0; i <= 3; i++) {
        ctx.fillRect(i * tile - 1.5, 0, 3, PX);
        ctx.fillRect(0, i * tile - 1.5, PX, 3);
      }
      for (let y = 0; y < 3; y++)
        for (let x = 0; x < 3; x++) {
          ctx.fillStyle = `rgba(255,220,190,${0.03 + ((x * 3 + y) % 4) * 0.02})`;
          ctx.fillRect(x * tile + 2, y * tile + 2, tile - 4, tile - 4);
        }
      break;
    }
    case "microcement": {
      fill("#cbc3b6");
      // Soft trowel clouds.
      for (let i = 0; i < 40; i++) {
        const x = (i * 97) % PX;
        const y = (i * 61) % PX;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 90);
        g.addColorStop(0, `rgba(${i % 2 ? "255,255,255" : "90,80,70"},.06)`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, PX, PX);
      }
      break;
    }
  }
}

const cache = new Map<FloorFinish, THREE.CanvasTexture>();

/** Floor texture tiling at 1 texture per metre (geometry UVs are in cm). */
export function floorTexture(finish: FloorFinish): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const hit = cache.get(finish);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = PX;
  canvas.height = PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  draw(finish, ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 100, 1 / 100);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(finish, tex);
  return tex;
}

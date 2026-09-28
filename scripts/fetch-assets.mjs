#!/usr/bin/env node
/**
 * Downloads the planner's 3D assets from Poly Haven (all CC0) and writes
 * browser-ready copies to public/:
 *   public/models/<id>.glb          meshopt geometry, WebP textures ≤ 1024 px
 *   public/textures/<id>/{diff,nor,arm}.webp   1K PBR maps
 *   src/components/planner/three/model-sizes.json   each model's size in cm (w, h, d)
 *
 * Re-run after changing the lists below: `node scripts/fetch-assets.mjs`.
 * Files already in public/ are kept; pass --force to download them again.
 * Needs network access and `npx @gltf-transform/cli` (fetched on first run).
 * `sharp` comes with Next.js.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.polyhaven.com";
const FORCE = process.argv.includes("--force");
const SHELL = { shell: process.platform === "win32" };

/** Poly Haven model ids used by src/components/planner/three/assets.ts. */
const MODELS = [
  "modern_arm_chair_01",
  "modern_coffee_table_01",
  "side_table_01",
  "modern_wooden_cabinet",
  "painted_wooden_chair_01",
  "dining_chair_02",
  "potted_plant_01",
  "potted_plant_02",
  "hanging_picture_frame_02",
];

/** Poly Haven texture ids: floors, plus wood and fabric for pieces built in code. */
const TEXTURES = [
  "wood_floor",
  "laminate_floor_02",
  "terracotta_floor_tiles",
  "plastered_wall_04",
  "oak_veneer_01",
  "poly_wool_herringbone",
];

/** Maps kept per texture; `arm` packs AO/roughness/metalness in R/G/B, as three.js reads them. */
const MAPS = { Diffuse: "diff", nor_gl: "nor", arm: "arm" };

async function json(url) {
  const res = await fetch(url, { headers: { "User-Agent": "raumplan-asset-fetch" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function download(url, path) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
}

const kb = (path) => `${Math.round(statSync(path).size / 1024)} KB`;

async function fetchModel(id) {
  const out = join(ROOT, "public", "models", `${id}.glb`);
  if (existsSync(out) && !FORCE) return;
  const files = await json(`${API}/files/${id}`);
  const gltf = files.gltf["1k"].gltf;
  const tmp = mkdtempSync(join(tmpdir(), `ph-${id}-`));
  try {
    const src = join(tmp, `${id}.gltf`);
    await download(gltf.url, src);
    for (const [rel, f] of Object.entries(gltf.include)) await download(f.url, join(tmp, rel));
    mkdirSync(dirname(out), { recursive: true });
    // prettier-ignore
    execFileSync("npx", ["-y", "@gltf-transform/cli@4", "optimize", src, out,
      "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "1024"],
      { stdio: "ignore", ...SHELL });
    console.log(`model   ${id}.glb  ${kb(out)}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Scene bounds from `gltf-transform inspect`, in cm, as [width x, height y, depth z]. */
function measure(id) {
  const csv = execFileSync("npx", ["-y", "@gltf-transform/cli@4", "inspect", join(ROOT, "public", "models", `${id}.glb`), "--format", "csv"], { encoding: "utf8", ...SHELL });
  const row = csv.split("SCENES")[1].split(/\r?\n/).find((l) => /^0,/.test(l));
  const [min, max] = [...row.matchAll(/"([^"]+)"/g)].map((m) => m[1].split(",").map(Number));
  return max.map((v, i) => Math.round((v - min[i]) * 1000) / 10);
}

async function fetchTexture(id) {
  const dir = join(ROOT, "public", "textures", id);
  if (existsSync(join(dir, "arm.webp")) && !FORCE) return;
  const files = await json(`${API}/files/${id}`);
  mkdirSync(dir, { recursive: true });
  for (const [key, name] of Object.entries(MAPS)) {
    const res = await fetch(files[key]["1k"].jpg.url);
    if (!res.ok) throw new Error(`${res.status} ${id} ${key}`);
    const out = join(dir, `${name}.webp`);
    await sharp(Buffer.from(await res.arrayBuffer()))
      .webp({ quality: name === "diff" ? 82 : 90 })
      .toFile(out);
    console.log(`texture ${id}/${name}.webp  ${kb(out)}`);
  }
}

for (const id of MODELS) await fetchModel(id);
for (const id of TEXTURES) await fetchTexture(id);

const sizes = Object.fromEntries(MODELS.map((id) => [id, measure(id)]));
writeFileSync(join(ROOT, "src", "components", "planner", "three", "model-sizes.json"), `${JSON.stringify(sizes, null, 2)}\n`);
console.log("sizes  ", sizes);

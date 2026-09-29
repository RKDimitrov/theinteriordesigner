import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { type Node, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { clearNodeParent, prune } from "@gltf-transform/functions";
import sharp from "sharp";
import type { MapName } from "../../src/domain/assets/manifest.ts";
import { bytesOf, PUBLIC, writeFile } from "./io.ts";

const SHELL = { shell: process.platform === "win32" };
const GLTF_TRANSFORM = ["-y", "@gltf-transform/cli@4"];

/** meshopt geometry and WebP textures; the decoder ships with three-stdlib, so no CDN. */
export function optimizeModel(src: string, out: string, textureSize: number): void {
  // prettier-ignore
  execFileSync("npx", [...GLTF_TRANSFORM, "optimize", src, out,
    "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", String(textureSize)],
    { stdio: "ignore", ...SHELL });
}

/**
 * Writes a copy of `src` holding only the nodes whose name matches `pattern`
 * (the outermost match of each branch), keeping their world placement.
 */
export async function extractNodes(src: string, out: string, pattern: string): Promise<void> {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(src);
  const root = doc.getRoot();
  const re = new RegExp(pattern);
  const matches = root.listNodes().filter((n) => re.test(n.getName()));
  const isInside = (n: Node) => {
    for (let p = n.getParentNode(); p; p = p.getParentNode()) if (matches.includes(p)) return true;
    return false;
  };
  const keep = matches.filter((n) => !isInside(n));
  if (!keep.length) throw new Error(`no node matches ${pattern}: ${root.listNodes().map((n) => n.getName()).filter(Boolean).slice(0, 40).join(", ")}`);
  for (const n of keep) clearNodeParent(n);
  for (const scene of root.listScenes()) {
    for (const child of scene.listChildren()) if (!keep.includes(child)) scene.removeChild(child);
    for (const n of keep) scene.addChild(n);
  }
  await doc.transform(prune());
  await io.write(out, doc);
}

/** Scene bounds from `gltf-transform inspect`, in cm, as [width x, height y, depth z]. */
export function measureModel(path: string): [number, number, number] {
  const csv = execFileSync("npx", [...GLTF_TRANSFORM, "inspect", path, "--format", "csv"], { encoding: "utf8", ...SHELL });
  const row = csv.split("SCENES")[1]?.split(/\r?\n/).find((l) => /^0,/.test(l));
  if (!row) throw new Error(`cannot read bounds of ${path}`);
  const [min, max] = [...row.matchAll(/"([^"]+)"/g)].map((m) => m[1]!.split(",").map(Number));
  if (!min || !max) throw new Error(`cannot read bounds of ${path}`);
  return [0, 1, 2].map((i) => Math.round((max[i]! - min[i]!) * 1000) / 10) as [number, number, number];
}

const MAX_MAP = 1024;

async function grey(data: Uint8Array | undefined, fill: number): Promise<Buffer | number> {
  if (!data) return fill;
  return sharp(data).resize(MAX_MAP, MAX_MAP, { fit: "fill" }).extractChannel(0).raw().toBuffer();
}

/** AO, roughness and metal packed into R, G and B, as three.js reads them. */
async function packArm(maps: Partial<Record<MapName, Uint8Array>>): Promise<Buffer> {
  const [ao, rough, metal] = await Promise.all([grey(maps.ao, 255), grey(maps.rough, 200), grey(maps.metal, 0)]);
  const px = MAX_MAP * MAX_MAP;
  const out = Buffer.alloc(px * 3);
  const at = (c: Buffer | number, i: number) => (typeof c === "number" ? c : c[i]!);
  for (let i = 0; i < px; i++) {
    out[i * 3] = at(ao, i);
    out[i * 3 + 1] = at(rough, i);
    out[i * 3 + 2] = at(metal, i);
  }
  return sharp(out, { raw: { width: MAX_MAP, height: MAX_MAP, channels: 3 } }).png().toBuffer();
}

/** DirectX normals point green the other way from OpenGL, which three.js expects. */
async function toGlNormal(data: Uint8Array): Promise<Buffer> {
  const { data: px, info } = await sharp(data).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 1; i < px.length; i += 3) px[i] = 255 - px[i]!;
  return sharp(px, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer();
}

const shrink = (data: Uint8Array) => sharp(data).resize(MAX_MAP, MAX_MAP, { fit: "inside", withoutEnlargement: true });

/**
 * Writes public/textures/<id>/{diff,nor,arm}.webp at up to 1K. Returns the
 * bytes written and the diffuse map's mean sRGB colour.
 */
export async function writeTexture(id: string, maps: Partial<Record<MapName, Uint8Array>>, normal: "gl" | "dx"): Promise<{ bytes: number; mean: [number, number, number] }> {
  if (!maps.diff || !maps.nor) throw new Error(`${id}: diffuse and normal maps are required`);
  const dir = join(PUBLIC, "textures", id);
  const nor = normal === "dx" ? await toGlNormal(maps.nor) : maps.nor;
  const arm = maps.arm ?? (await packArm(maps));
  let bytes = 0;
  for (const [name, data, quality] of [["diff", maps.diff, 82], ["nor", nor, 90], ["arm", arm, 90]] as const) {
    const webp = await shrink(data).webp({ quality }).toBuffer();
    writeFile(join(dir, `${name}.webp`), webp);
    bytes += webp.length;
  }
  return { bytes, mean: await meanColour(join(dir, "diff.webp")) };
}

export async function meanColour(path: string): Promise<[number, number, number]> {
  const { channels } = await sharp(path).stats();
  return [0, 1, 2].map((i) => Math.round(channels[i]!.mean)) as [number, number, number];
}

/** A 2048 × 1024 equirectangular JPG for the view outside the windows. */
export async function writeBackplate(id: string, image: Uint8Array): Promise<number> {
  const jpg = await sharp(image, { limitInputPixels: false }).resize(2048, 1024, { fit: "fill" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  const out = join(PUBLIC, "hdris", `${id}.jpg`);
  writeFile(out, jpg);
  return jpg.length;
}

export function writeHdri(id: string, hdr: Uint8Array): number {
  const out = join(PUBLIC, "hdris", `${id}.hdr`);
  writeFile(out, hdr);
  return bytesOf(out);
}

/** A 256 px WebP preview in public/thumbs; whole models are letterboxed, surfaces cropped. */
export async function writeThumb(id: string, image: Uint8Array, fit: "contain" | "cover"): Promise<void> {
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  const webp = await sharp(image).resize(256, 256, { fit, background: transparent }).webp({ quality: 80 }).toBuffer();
  writeFile(join(PUBLIC, "thumbs", `${id}.webp`), webp);
}

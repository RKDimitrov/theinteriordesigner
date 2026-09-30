import type { Licence } from "../../src/domain/assets/licence.ts";
import type { ManifestEntry } from "../../src/domain/assets/manifest.ts";
import { getJson } from "./io.ts";

/*
 * Finds furniture models on Sketchfab that could join the manifest:
 *
 *   node scripts/fetch-assets.mjs --find <category> [--query "<words>"] [--limit <n>]
 *
 * Prints candidate manifest entries as JSON (with a thumbnail, face count and
 * likes for review) and writes nothing. A person still looks at each one,
 * picks, and adds style tags; the fetch step checks the licence again.
 */

const API = "https://api.sketchfab.com/v3";

export interface SketchfabHit {
  uid: string;
  name: string;
  user?: { displayName?: string; username?: string };
  license?: { label?: string } | null;
  faceCount?: number;
  likeCount?: number;
  viewerUrl: string;
  archives?: { glb?: { size?: number } };
  thumbnails?: { images: { width: number; url: string }[] };
}

/** Search results name the licence by label; only these two may ship. */
const LICENCE_BY_LABEL: Readonly<Record<string, Licence>> = { "CC Attribution": "cc-by-4.0", "CC0 Public Domain": "cc0" };

/** Fewer faces is a toy, more will not compress into the model budget. */
const MIN_FACES = 300;
const MAX_FACES = 150_000;
/** Downloads far above this are mostly 4K textures and rarely shrink enough. */
const MAX_GLB_BYTES = 120_000_000;
/** Titles of rooms, collections and pieces that are not meant to look real. */
const NOT_ONE_REAL_PIECE = /\b(pack|set|collection|kit|scene|room|interior|house|apartment|diorama|low[\s-]?poly|lowpoly|stylized|stylised|cartoon|voxel|pixel|toon|minecraft|roblox|sims)\b/i;

export function isCandidate(h: SketchfabHit, known: ReadonlySet<string>): boolean {
  if (known.has(h.uid)) return false;
  if (!LICENCE_BY_LABEL[h.license?.label ?? ""]) return false;
  const faces = h.faceCount ?? 0;
  if (faces < MIN_FACES || faces > MAX_FACES) return false;
  if ((h.archives?.glb?.size ?? 0) > MAX_GLB_BYTES) return false;
  return !NOT_ONE_REAL_PIECE.test(h.name);
}

/** A manifest id from the category, the title and the author: lower case, a to z, digits and underscores. */
export function slugId(category: string, title: string, author: string): string {
  const words = (s: string) =>
    s
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
  // The category leads, so its own word in the title only repeats it.
  const stem = category.replace(/_/g, "");
  const title0 = words(title).filter((w) => w !== category && w !== stem && !category.split("_").includes(w));
  const id = [category, ...title0.slice(0, 4), ...words(author).slice(0, 2)].join("_");
  return id.slice(0, 80).replace(/_+$/, "");
}

export function candidateEntry(category: string, h: SketchfabHit): ManifestEntry {
  const author = h.user?.displayName || h.user?.username || "";
  return {
    id: slugId(category, h.name, author),
    kind: "model",
    source: "sketchfab",
    ref: h.uid,
    title: h.name,
    author,
    sourceUrl: h.viewerUrl,
    licence: LICENCE_BY_LABEL[h.license?.label ?? ""]!,
    tags: [`furniture.${category}`],
  };
}

export interface Candidate {
  entry: ManifestEntry;
  thumb: string | undefined;
  faces: number;
  likes: number;
  glbMb: number;
}

/** The best-liked downloadable models for `query` under each allowed licence, filtered and de-duplicated. */
export async function findCandidates(category: string, query: string, known: ReadonlySet<string>, limit: number): Promise<Candidate[]> {
  const out = new Map<string, Candidate>();
  for (const licence of ["by", "cc0"]) {
    const url = `${API}/search?type=models&downloadable=true&license=${licence}&categories=furniture-home&sort_by=-likeCount&count=24&q=${encodeURIComponent(query)}`;
    const page = await getJson<{ results: SketchfabHit[] }>(url);
    for (const h of page.results) {
      if (!isCandidate(h, known) || out.has(h.uid)) continue;
      const images = [...(h.thumbnails?.images ?? [])].sort((a, b) => a.width - b.width);
      out.set(h.uid, {
        entry: candidateEntry(category, h),
        thumb: (images.find((i) => i.width >= 256) ?? images.at(-1))?.url,
        faces: h.faceCount ?? 0,
        likes: h.likeCount ?? 0,
        glbMb: Math.round((h.archives?.glb?.size ?? 0) / 1e5) / 10,
      });
    }
  }
  return [...out.values()].sort((a, b) => b.likes - a.likes).slice(0, limit);
}

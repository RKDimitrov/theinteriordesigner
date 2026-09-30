/**
 * The asset pipeline: reads assets/manifest/*.json, downloads each entry from
 * its source, writes browser-ready files to public/ and the catalogue to
 * src/components/planner/three/asset-catalogue.json.
 *
 *   node scripts/fetch-assets.mjs                 fetch what is missing
 *   node scripts/fetch-assets.mjs --force         fetch everything again
 *   node scripts/fetch-assets.mjs --only <id>     one entry (repeatable)
 *   node scripts/fetch-assets.mjs --source <s>    one source, e.g. sketchfab
 *   node scripts/fetch-assets.mjs --check         offline: manifest, outputs, orphans
 *   node scripts/fetch-assets.mjs --find <category> [--query "<words>"] [--limit <n>]
 *                                                 list Sketchfab candidates for review; writes nothing
 *   node scripts/fetch-assets.mjs --renders       catalogue pictures of the furniture models that lack one
 *                                                 (all of them with --force, some with --only)
 *
 * See docs/superpowers/specs/2026-09-28-asset-pipeline-design.md.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { Catalogue, CatalogueEntry, MODEL_BUDGET_BYTES, assetPaths } from "../../src/domain/assets/catalogue.ts";
import { Manifest, manifestIssues, type ManifestEntry } from "../../src/domain/assets/manifest.ts";
import { findCandidates } from "./find.ts";
import { bytesOf, exists, getBytes, kb, PUBLIC, ROOT } from "./io.ts";
import { idsModule, mergeCatalogue, missingRenders, orphans, outputsOf, renderTargets } from "./plan.ts";
import { extractNodes, measureModel, meanColour, optimizeModel, writeBackplate, writeHdri, writeTexture, writeThumb } from "./process.ts";
import { renderModels } from "./render.ts";
import { ADAPTERS } from "./sources/index.ts";

const THREE_DIR = join(ROOT, "src", "components", "planner", "three");
const CATALOGUE = join(THREE_DIR, "asset-catalogue.json");
const IDS = join(THREE_DIR, "asset-ids.ts");
const ASSET_DIRS = ["models", "textures", "hdris", "thumbs", "renders"];

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const values = (name: string) => args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1]!] : []));

function loadManifest(): ManifestEntry[] {
  const raw = ["models", "textures", "hdris"].flatMap((f) => JSON.parse(readFileSync(join(ROOT, "assets", "manifest", `${f}.json`), "utf8")) as unknown[]);
  const entries = Manifest.parse(raw);
  const issues = manifestIssues(entries);
  if (issues.length) throw new Error(`manifest:\n  ${issues.join("\n  ")}`);
  return entries;
}

function loadCatalogue(): Catalogue {
  return exists(CATALOGUE) ? Catalogue.parse(JSON.parse(readFileSync(CATALOGUE, "utf8"))) : {};
}

const onDisk = (path: string) => exists(join(PUBLIC, path));
/** The catalogue picture's public path, once it has been rendered. */
const renderOf = (id: string) => (onDisk(assetPaths.render(id)) ? assetPaths.render(id) : undefined);

function publicFiles(): string[] {
  return ASSET_DIRS.flatMap((dir) => {
    const abs = join(PUBLIC, dir);
    if (!exists(abs)) return [];
    return readdirSync(abs, { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => `/${relative(PUBLIC, join(d.parentPath, d.name)).split(sep).join("/")}`);
  });
}

/** Offline consistency check; returns the problems found. */
function check(entries: ManifestEntry[], catalogue: Catalogue): string[] {
  const problems: string[] = [];
  for (const e of entries) {
    for (const p of outputsOf(e)) if (!onDisk(p)) problems.push(`${e.id}: missing ${p}`);
    if (!catalogue[e.id]) problems.push(`${e.id}: not in the catalogue`);
    else if (catalogue[e.id]!.kind !== e.kind) problems.push(`${e.id}: catalogue kind differs`);
    if (e.kind === "model" && onDisk(assetPaths.model(e.id)) && bytesOf(join(PUBLIC, assetPaths.model(e.id))) > MODEL_BUDGET_BYTES) {
      problems.push(`${e.id}: over the ${kb(MODEL_BUDGET_BYTES)} model budget`);
    }
  }
  const files = publicFiles();
  for (const id of missingRenders(catalogue, files)) problems.push(`${id}: no catalogue picture (run with --renders)`);
  for (const f of orphans(files, entries)) problems.push(`orphan file ${f}`);
  return problems;
}

/** Downloads and processes one entry; returns its catalogue row. */
async function build(e: ManifestEntry): Promise<CatalogueEntry> {
  const adapter = ADAPTERS[e.source];
  const common = { title: e.title, author: e.author, source: e.source, sourceUrl: e.sourceUrl, licence: e.licence, tags: e.tags };
  const verify = (licence: string | null) => {
    if (licence === null) throw new Error(`${e.id}: the source's licence may not be shipped`);
    if (licence !== e.licence) throw new Error(`${e.id}: manifest says ${e.licence}, source says ${licence}`);
  };
  const thumb = async (raw: { thumbUrl?: string; thumbData?: Uint8Array }) => {
    const image = raw.thumbData ?? (raw.thumbUrl ? await getBytes(raw.thumbUrl) : undefined);
    if (!image) return undefined;
    await writeThumb(e.id, image, e.kind === "model" ? "contain" : "cover");
    return assetPaths.thumb(e.id);
  };

  if (e.kind === "model") {
    if (!adapter.model) throw new Error(`${e.source} has no models`);
    const tmp = mkdtempSync(join(tmpdir(), `asset-${e.id}-`));
    try {
      const raw = await adapter.model(e, tmp);
      verify(raw.licence);
      const out = join(PUBLIC, assetPaths.model(e.id));
      let src = raw.file;
      if (e.node) {
        src = join(tmp, "extracted.glb");
        await extractNodes(raw.file, src, e.node);
      }
      optimizeModel(src, out, e.textureSize ?? 1024);
      const bytes = bytesOf(out);
      if (bytes > MODEL_BUDGET_BYTES) throw new Error(`${e.id}: ${kb(bytes)} is over the ${kb(MODEL_BUDGET_BYTES)} model budget`);
      // A picture of the previous file would no longer show this model.
      rmSync(join(PUBLIC, assetPaths.render(e.id)), { force: true });
      return { kind: "model", ...common, bytes, size: measureModel(out), thumb: await thumb(raw) };
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  if (e.kind === "texture") {
    if (!adapter.texture) throw new Error(`${e.source} has no textures`);
    const raw = await adapter.texture(e);
    verify(raw.licence);
    const tileCm = e.tileCm ?? raw.tileCm;
    if (!tileCm) throw new Error(`${e.id}: no tile size from the source; set tileCm`);
    const { bytes, mean } = await writeTexture(e.id, raw.maps, e.normal ?? "gl");
    return { kind: "texture", ...common, bytes, tileCm, mean, thumb: await thumb(raw) };
  }
  if (!adapter.hdri) throw new Error(`${e.source} has no HDRIs`);
  const raw = await adapter.hdri(e);
  verify(raw.licence);
  const bytes = e.backplate ? await writeBackplate(e.id, raw.hdr) : writeHdri(e.id, raw.hdr);
  return { kind: "hdri", ...common, ...(e.backplate ? { backplate: true } : {}), bytes, thumb: await thumb(raw) };
}

/**
 * The catalogue row for files already on disk, from the manifest and the
 * previous row; null when that row is missing and the entry needs a fetch.
 */
async function refresh(e: ManifestEntry, old: CatalogueEntry | undefined): Promise<CatalogueEntry | null> {
  if (!old || old.kind !== e.kind) return null;
  const common = { title: e.title, author: e.author, source: e.source, sourceUrl: e.sourceUrl, licence: e.licence, tags: e.tags, thumb: onDisk(assetPaths.thumb(e.id)) ? assetPaths.thumb(e.id) : undefined };
  const files = outputsOf(e).map((p) => join(PUBLIC, p));
  const bytes = files.reduce((n, f) => n + bytesOf(f), 0);
  if (old.kind === "model") return { ...old, ...common, bytes, size: measureModel(files[0]!), render: renderOf(e.id) };
  if (old.kind === "texture") return { ...old, ...common, bytes, tileCm: e.kind === "texture" && e.tileCm ? e.tileCm : old.tileCm, mean: await meanColour(files[0]!) };
  return { ...old, ...common, bytes };
}

async function main() {
  const entries = loadManifest();
  const old = loadCatalogue();

  if (flag("--check")) {
    const problems = check(entries, old);
    for (const p of problems) console.error(`  ${p}`);
    console.log(problems.length ? `${problems.length} problem(s)` : `ok: ${entries.length} assets`);
    process.exit(problems.length ? 1 : 0);
  }

  const find = values("--find")[0];
  if (find) {
    const known = new Set(entries.map((e) => e.ref));
    const found = await findCandidates(find, values("--query")[0] ?? find.replace(/_/g, " "), known, Number(values("--limit")[0] ?? 24));
    console.log(JSON.stringify(found, null, 2));
    process.exit(0);
  }

  const only = values("--only");
  if (flag("--renders")) {
    const ids = renderTargets(old).filter((id) => (!only.length || only.includes(id)) && (flag("--force") || !renderOf(id)));
    const failed = await renderModels(ids, console.log);
    const catalogue: Catalogue = Object.fromEntries(Object.entries(old).map(([id, row]) => [id, row.kind === "model" ? { ...row, render: renderOf(id) } : row]));
    writeFileSync(CATALOGUE, `${JSON.stringify(catalogue, null, 2)}\n`);
    console.log(failed.length ? `${failed.length} failed: ${failed.join(", ")}` : `ok: ${ids.length} rendered`);
    process.exit(failed.length ? 1 : 0);
  }
  const sources = values("--source");
  const chosen = entries.filter((e) => (!only.length || only.includes(e.id)) && (!sources.length || sources.includes(e.source)));
  const fresh: Catalogue = {};
  const failed: string[] = [];
  for (const e of chosen) {
    try {
      const have = outputsOf(e).every(onDisk);
      const row = have && !flag("--force") ? await refresh(e, old[e.id]) : null;
      fresh[e.id] = row ?? (await build(e));
      console.log(`${row ? "kept " : "built"} ${e.kind.padEnd(7)} ${e.id}  ${kb(fresh[e.id]!.bytes)}`);
    } catch (err) {
      failed.push(e.id);
      console.error(`FAILED ${e.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const catalogue = mergeCatalogue(old, fresh, entries);
  writeFileSync(CATALOGUE, `${JSON.stringify(catalogue, null, 2)}\n`);
  writeFileSync(IDS, idsModule(catalogue));
  if (failed.length) {
    console.error(`${failed.length} failed: ${failed.join(", ")}`);
    process.exit(1);
  }
}

await main();

#!/usr/bin/env node
/**
 * Downloads the planner's 3D assets listed in assets/manifest/*.json and
 * writes browser-ready copies to public/ plus the generated catalogue
 * src/components/planner/three/asset-catalogue.json.
 *
 *   node scripts/fetch-assets.mjs [--force] [--only <id>] [--source <name>] [--check]
 *
 * The pipeline is TypeScript in scripts/assets/, which Node 22 runs directly.
 * Needs network access and `npx @gltf-transform/cli` (fetched on first run);
 * Sketchfab entries need SKETCHFAB_TOKEN in .env.local.
 */
// The pipeline's .ts files have no "type" in package.json to go by; Node
// detects ES modules fine, so its note about reparsing is only noise.
process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.code !== "MODULE_TYPELESS_PACKAGE_JSON") console.warn(w);
});
await import("./assets/cli.ts");

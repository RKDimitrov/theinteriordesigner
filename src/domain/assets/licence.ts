/**
 * Licences an asset may have to ship inside the app. A web app serves the raw
 * file, which counts as redistribution, so anything non-commercial (NC),
 * no-derivatives (ND), share-alike (SA) or store-only is refused.
 *
 * Imported by scripts/assets with a relative path, so keep it free of `@/`.
 */
export const LICENCES = ["cc0", "cc-by-3.0", "cc-by-4.0"] as const;
export type Licence = (typeof LICENCES)[number];

export const LICENCE_URL: Readonly<Record<Licence, string>> = {
  cc0: "https://creativecommons.org/publicdomain/zero/1.0/",
  "cc-by-3.0": "https://creativecommons.org/licenses/by/3.0/",
  "cc-by-4.0": "https://creativecommons.org/licenses/by/4.0/",
};

export const LICENCE_LABEL: Readonly<Record<Licence, string>> = {
  cc0: "CC0 1.0",
  "cc-by-3.0": "CC BY 3.0",
  "cc-by-4.0": "CC BY 4.0",
};

/** CC-BY assets must be credited on the credits page. */
export const isAttribution = (l: Licence): boolean => l !== "cc0";

export const SOURCES = ["polyhaven", "ambientcg", "sketchfab", "khronos", "polypizza", "kenney", "quaternius", "cgbookcase", "3dtextures", "url"] as const;
export type Source = (typeof SOURCES)[number];

/** Display name and home page of each source, for the credits page. */
export const SOURCE_SITE: Readonly<Record<Source, { name: string; url: string }>> = {
  polyhaven: { name: "Poly Haven", url: "https://polyhaven.com" },
  ambientcg: { name: "ambientCG", url: "https://ambientcg.com" },
  sketchfab: { name: "Sketchfab", url: "https://sketchfab.com" },
  khronos: { name: "Khronos glTF Sample Assets", url: "https://github.com/KhronosGroup/glTF-Sample-Assets" },
  polypizza: { name: "Poly Pizza", url: "https://poly.pizza" },
  kenney: { name: "Kenney", url: "https://kenney.nl" },
  quaternius: { name: "Quaternius", url: "https://quaternius.com" },
  cgbookcase: { name: "cgbookcase", url: "https://www.cgbookcase.com" },
  "3dtextures": { name: "3dtextures.me", url: "https://3dtextures.me" },
  // Named by each asset's own host instead; see creditGroups.
  url: { name: "", url: "" },
};

const SKETCHFAB: Readonly<Record<string, Licence>> = { cc0: "cc0", by: "cc-by-4.0" };

/**
 * The licence a source reports, in our terms; null when it is not allowed or
 * not recognised. Poly Haven and ambientCG publish everything as CC0.
 */
export function sourceLicence(source: Source, raw: string | undefined): Licence | null {
  if (source === "polyhaven" || source === "ambientcg") return "cc0";
  if (raw === undefined) return null;
  if (source === "sketchfab") return SKETCHFAB[raw] ?? null;
  const label = raw.toLowerCase().replace(/[\s_]+/g, "-");
  if (/-(nc|nd|sa)\b/.test(label)) return null;
  if (label.startsWith("cc0")) return "cc0";
  const by = /^cc-by-(\d)\.0$/.exec(label);
  if (by?.[1] === "3") return "cc-by-3.0";
  if (by?.[1] === "4") return "cc-by-4.0";
  return null;
}

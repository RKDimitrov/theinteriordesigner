import type { Catalogue } from "./catalogue.ts";
import { isAttribution, LICENCE_LABEL, LICENCE_URL, SOURCE_SITE } from "./licence.ts";

export interface AttributionCredit {
  id: string;
  title: string;
  author: string;
  sourceUrl: string;
  licenceLabel: string;
  licenceUrl: string;
}

export interface SourceCredit {
  name: string;
  url: string;
  count: number;
  authors: string[];
}

/**
 * What the credits page shows: every CC-BY asset on its own (the licence
 * requires it), and CC0 assets summed up per source site.
 */
export function creditGroups(catalogue: Catalogue): { attribution: AttributionCredit[]; publicDomain: SourceCredit[] } {
  const attribution: AttributionCredit[] = [];
  const sites = new Map<string, { url: string; count: number; authors: Set<string> }>();
  for (const [id, e] of Object.entries(catalogue)) {
    if (isAttribution(e.licence)) {
      attribution.push({ id, title: e.title, author: e.author, sourceUrl: e.sourceUrl, licenceLabel: LICENCE_LABEL[e.licence], licenceUrl: LICENCE_URL[e.licence] });
      continue;
    }
    const known = SOURCE_SITE[e.source];
    const origin = new URL(e.sourceUrl);
    const [name, url] = known.name ? [known.name, known.url] : [origin.hostname, origin.origin];
    const site = sites.get(name) ?? { url, count: 0, authors: new Set<string>() };
    site.count++;
    for (const a of e.author.split(",")) if (a.trim()) site.authors.add(a.trim());
    sites.set(name, site);
  }
  attribution.sort((a, b) => a.title.localeCompare(b.title));
  const publicDomain = [...sites]
    .map(([name, s]) => ({ name, url: s.url, count: s.count, authors: [...s.authors].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { attribution, publicDomain };
}

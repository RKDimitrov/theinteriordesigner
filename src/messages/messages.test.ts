import { isStructurallySame, parse } from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import bg from "./bg.json";
import de from "./de.json";
import en from "./en.json";

type Tree = { [key: string]: string | Tree };

const catalogues: Record<(typeof routing.locales)[number], Tree> = { en, de, bg };

/** Flatten nested messages to "Namespace.key" → message. */
function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const english = flatten(en);

describe("message catalogues", () => {
  it("has a catalogue for every routed locale", () => {
    expect(Object.keys(catalogues).sort()).toEqual([...routing.locales].sort());
  });

  describe.each(routing.locales.filter((l) => l !== "en"))("%s", (locale) => {
    const messages = flatten(catalogues[locale]);

    it("has exactly the English keys", () => {
      const missing = [...english.keys()].filter((k) => !messages.has(k));
      const extra = [...messages.keys()].filter((k) => !english.has(k));
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });

    it("keeps every placeholder, plural and tag of the English message", () => {
      const mismatches: string[] = [];
      for (const [key, source] of english) {
        const translated = messages.get(key);
        if (translated == null) continue;
        const result = isStructurallySame(parse(source), parse(translated));
        if (!result.success) mismatches.push(`${key}: ${result.error?.message}`);
      }
      expect(mismatches).toEqual([]);
    });

    it("translates something (not a copy of English)", () => {
      const same = [...english].filter(([k, v]) => messages.get(k) === v).length;
      expect(same / english.size).toBeLessThan(0.25);
    });
  });
});

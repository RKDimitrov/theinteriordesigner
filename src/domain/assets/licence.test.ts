import { describe, expect, it } from "vitest";
import { isAttribution, LICENCE_URL, sourceLicence } from "./licence.ts";

describe("sourceLicence", () => {
  it("treats Poly Haven and ambientCG as CC0 whatever they report", () => {
    expect(sourceLicence("polyhaven", undefined)).toBe("cc0");
    expect(sourceLicence("ambientcg", "anything")).toBe("cc0");
  });

  it("accepts only CC0 and CC-BY Sketchfab models", () => {
    expect(sourceLicence("sketchfab", "cc0")).toBe("cc0");
    expect(sourceLicence("sketchfab", "by")).toBe("cc-by-4.0");
    for (const slug of ["by-nc", "by-nd", "by-sa", "by-nc-sa", "by-nc-nd", "st", "ed", undefined]) {
      expect(sourceLicence("sketchfab", slug), String(slug)).toBeNull();
    }
  });

  it("reads Poly Pizza labels", () => {
    expect(sourceLicence("polypizza", "CC0 1.0")).toBe("cc0");
    expect(sourceLicence("polypizza", "CC-BY 3.0")).toBe("cc-by-3.0");
    expect(sourceLicence("polypizza", "CC BY-NC 4.0")).toBeNull();
  });
});

describe("licence helpers", () => {
  it("flags attribution licences", () => {
    expect(isAttribution("cc0")).toBe(false);
    expect(isAttribution("cc-by-3.0")).toBe(true);
  });

  it("links every licence to its deed", () => {
    expect(LICENCE_URL["cc-by-4.0"]).toBe("https://creativecommons.org/licenses/by/4.0/");
  });
});

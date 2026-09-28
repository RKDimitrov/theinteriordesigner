import { describe, expect, it } from "vitest";
import { acgZipUrl, type AcgAsset } from "./ambientcg.ts";
import { sketchfabThumb } from "./sketchfab.ts";
import { zipMaps } from "./zip-maps.ts";

describe("zipMaps", () => {
  it("finds ambientCG maps and prefers the OpenGL normal", () => {
    const names = [
      "Plaster001.png",
      "Plaster001_1K-JPG_Color.jpg",
      "Plaster001_1K-JPG_NormalGL.jpg",
      "Plaster001_1K-JPG_NormalDX.jpg",
      "Plaster001_1K-JPG_Roughness.jpg",
      "Plaster001_1K-JPG_AmbientOcclusion.jpg",
      "Plaster001_1K-JPG_Displacement.jpg",
    ];
    expect(zipMaps(names, {})).toEqual({
      diff: "Plaster001_1K-JPG_Color.jpg",
      nor: "Plaster001_1K-JPG_NormalGL.jpg",
      rough: "Plaster001_1K-JPG_Roughness.jpg",
      ao: "Plaster001_1K-JPG_AmbientOcclusion.jpg",
    });
  });

  it("reads the usual names from other sites", () => {
    const names = ["brick/brick_basecolor.png", "brick/brick_normal.png", "brick/brick_roughness.png", "brick/brick_ao.png"];
    expect(zipMaps(names, {})).toMatchObject({ diff: "brick/brick_basecolor.png", nor: "brick/brick_normal.png" });
  });

  it("takes overrides from the manifest", () => {
    const names = ["x_alb.png", "x_n.png"];
    expect(zipMaps(names, { maps: { diff: "_alb\\.", nor: "_n\\." } })).toEqual({ diff: "x_alb.png", nor: "x_n.png" });
  });

  it("fails when diffuse or normal is missing", () => {
    expect(() => zipMaps(["x_Color.jpg"], {})).toThrow(/missing/);
  });
});

describe("ambientCG", () => {
  it("picks the 1K JPG zip", () => {
    const asset: AcgAsset = {
      assetId: "Plaster001",
      downloadFolders: {
        default: {
          downloadFiletypeCategories: {
            zip: {
              downloads: [
                { attribute: "2K-JPG", downloadLink: "https://ambientcg.com/get?file=Plaster001_2K-JPG.zip" },
                { attribute: "1K-JPG", downloadLink: "https://ambientcg.com/get?file=Plaster001_1K-JPG.zip" },
              ],
            },
          },
        },
      },
    };
    expect(acgZipUrl(asset)).toBe("https://ambientcg.com/get?file=Plaster001_1K-JPG.zip");
  });
});

describe("Sketchfab", () => {
  it("picks the smallest thumbnail at least 256 px wide", () => {
    const images = [1024, 200, 256, 720].map((width) => ({ width, url: `t${width}` }));
    expect(sketchfabThumb({ uid: "x", isDownloadable: true, thumbnails: { images } })).toBe("t256");
  });
});

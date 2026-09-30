import { describe, expect, it } from "vitest";
import { effectiveQuality, judgeFrameRate, parseStoredQuality, QUALITY, stepDown, stepUp } from "./quality";

describe("quality levels", () => {
  it("makes Low the cheapest: no occlusion, glow or decor, full-size pixels and at most three lights", () => {
    expect(QUALITY.low).toMatchObject({ ao: false, bloom: false, decor: false, maxLights: 3 });
    expect(QUALITY.low.dpr).toEqual([1, 1]);
  });

  it("asks for more at every step up", () => {
    expect(QUALITY.low.maxLights).toBeLessThan(QUALITY.medium.maxLights);
    expect(QUALITY.medium.maxLights).toBeLessThan(QUALITY.high.maxLights);
    expect(QUALITY.low.dpr[1]).toBeLessThan(QUALITY.medium.dpr[1]);
    expect(QUALITY.medium.dpr[1]).toBeLessThan(QUALITY.high.dpr[1]);
    expect(QUALITY.low.shadowMap).toBeLessThanOrEqual(QUALITY.medium.shadowMap);
    expect(QUALITY.medium.shadowMap).toBeLessThanOrEqual(QUALITY.high.shadowMap);
  });

  it("steps one level at a time and stops at the ends", () => {
    expect(stepDown("high")).toBe("medium");
    expect(stepDown("medium")).toBe("low");
    expect(stepDown("low")).toBe("low");
    expect(stepUp("low")).toBe("medium");
    expect(stepUp("high")).toBe("high");
  });
});

describe("judgeFrameRate", () => {
  it("steps down when the view is sluggish, up when it is fully smooth, and otherwise holds", () => {
    expect(judgeFrameRate(18)).toBe("down");
    expect(judgeFrameRate(40)).toBe("hold");
    expect(judgeFrameRate(60)).toBe("up");
  });
});

describe("effectiveQuality", () => {
  it("follows the measured level on Auto and the user's choice otherwise", () => {
    expect(effectiveQuality("auto", "medium")).toBe("medium");
    expect(effectiveQuality("low", "high")).toBe("low");
  });
});

describe("parseStoredQuality", () => {
  it("reads what was saved", () => {
    expect(parseStoredQuality(JSON.stringify({ choice: "low", measured: "medium" }))).toEqual({ choice: "low", measured: "medium" });
  });

  it("falls back to Auto at High for nothing, rubbish or an unknown level", () => {
    const fresh = { choice: "auto", measured: "high" };
    expect(parseStoredQuality(null)).toEqual(fresh);
    expect(parseStoredQuality("{not json")).toEqual(fresh);
    expect(parseStoredQuality(JSON.stringify({ choice: "ultra", measured: "high" }))).toEqual(fresh);
  });
});

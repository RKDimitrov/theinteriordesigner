import { describe, expect, it } from "vitest";
import { approach, shortestTurn, smoothstep } from "./walk-motion";

describe("approach", () => {
  it("closes most of the gap in a second at rate 5, whatever the frame rate", () => {
    let fine = 0;
    for (let i = 0; i < 120; i++) fine = approach(fine, 100, 5, 1 / 120);
    const coarse = approach(0, 100, 5, 1);
    expect(fine).toBeCloseTo(coarse, 6);
    expect(coarse).toBeGreaterThan(99);
  });
});

describe("shortestTurn", () => {
  it("turns the short way round", () => {
    expect(shortestTurn(350, 10)).toBe(20);
    expect(shortestTurn(10, 350)).toBe(-20);
    expect(shortestTurn(-170, 170)).toBe(-20);
    expect(shortestTurn(90, 90)).toBe(0);
  });
});

describe("smoothstep", () => {
  it("starts and ends still, and is clamped", () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBe(0.5);
    expect(smoothstep(2)).toBe(1);
    expect(smoothstep(0.1)).toBeLessThan(0.1);
  });
});

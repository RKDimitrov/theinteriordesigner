import { describe, expect, it } from "vitest";
import { chooseModel, distortion, styleFit } from "./choice";

const sofa = (id: string, size: [number, number, number], styles: string[] = []) => ({ id, size, styles });

describe("distortion", () => {
  it("is zero for a uniformly scaled copy and grows with stretching", () => {
    expect(distortion([200, 80, 90], 100, 45, 40)).toBeCloseTo(0);
    expect(distortion([200, 80, 90], 300, 90, 80)).toBeGreaterThan(0.35);
  });
});

describe("styleFit", () => {
  it("is the profile's best score among the model's styles, 0 without a profile", () => {
    expect(styleFit(["japandi", "minimal"], { japandi: 0.4, minimal: 0.9 })).toBe(0.9);
    expect(styleFit(["boho"], { japandi: 0.4 })).toBe(0);
    expect(styleFit(["boho"], null)).toBe(0);
  });
});

describe("chooseModel", () => {
  const twoSeat = sofa("two_seat", [160, 80, 90], ["boho"]);
  const threeSeat = sofa("three_seat", [230, 80, 90], ["minimal"]);

  it("without a profile, picks the model that needs the least stretching", () => {
    expect(chooseModel([twoSeat, threeSeat], 225, 90, 80, null).id).toBe("three_seat");
    expect(chooseModel([twoSeat, threeSeat], 160, 90, 80, null).id).toBe("two_seat");
  });

  it("prefers the profile's style when the proportions are close", () => {
    const boho = { boho: 0.9, minimal: 0.2 };
    expect(chooseModel([twoSeat, threeSeat], 200, 90, 80, boho).id).toBe("two_seat");
  });

  it("does not let style win over a badly stretched model", () => {
    const boho = { boho: 0.9, minimal: 0.2 };
    expect(chooseModel([twoSeat, threeSeat], 300, 95, 80, boho).id).toBe("three_seat");
  });

  it("is deterministic: the first listed wins a tie", () => {
    const a = sofa("a", [200, 80, 90]);
    const b = sofa("b", [200, 80, 90]);
    expect(chooseModel([a, b], 200, 90, 80, null).id).toBe("a");
    expect(chooseModel([b, a], 200, 90, 80, null).id).toBe("b");
  });
});

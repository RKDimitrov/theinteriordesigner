import { describe, expect, it } from "vitest";
import { classifyClimate, type DailyClimate, summarizeClimate } from "./climate";

/** Two synthetic years: Jan/Jul days only, enough to exercise the maths. */
function fixture(janT: number, julT: number, hum: number): DailyClimate {
  const time = ["2023-01-15", "2023-07-15", "2024-01-15", "2024-07-15"];
  return {
    time,
    temperatureMeanC: [janT, julT, janT, julT],
    humidityMeanPct: [hum, hum, hum, null],
    daylightSeconds: [8 * 3600, 16 * 3600, 8 * 3600, 16 * 3600],
    sunshineSeconds: [1 * 3600, 9 * 3600, 2 * 3600, 9 * 3600],
  };
}

describe("summarizeClimate", () => {
  it("computes HDD per year, humidity and northern winter light", () => {
    const s = summarizeClimate(fixture(0, 20, 80), 52);
    expect(s.years).toBe(2);
    expect(s.heatingDegreeDays).toBe(18); // one 0 °C day per year adds 18
    expect(s.meanHumidityPct).toBe(80);
    expect(s.winterDaylightHours).toBe(8);
    expect(s.winterSunshineHours).toBe(1.5);
    expect(s.meanTempC).toBe(10);
  });

  it("uses June–August as winter in the southern hemisphere", () => {
    const s = summarizeClimate(fixture(25, 10, 50), -34);
    expect(s.winterDaylightHours).toBe(16);
    expect(s.winterSunshineHours).toBe(9);
    expect(s.heatingDegreeDays).toBe(8);
  });

  it("ignores null values", () => {
    const d = fixture(0, 20, 80);
    const s = summarizeClimate({ ...d, temperatureMeanC: [null, null, null, null] }, 52);
    expect(s.heatingDegreeDays).toBe(0);
    expect(s.meanTempC).toBe(0);
  });
});

describe("classifyClimate", () => {
  const base = { heatingDegreeDays: 3200, meanHumidityPct: 78, winterDaylightHours: 8, winterSunshineHours: 1.2, meanTempC: 9, years: 10 };

  it("classifies a cold, humid, dark climate", () => {
    const c = classifyClimate(base);
    expect(c).toMatchObject({ heating: "high", humidity: "humid", winterLight: "low" });
    expect(c.hints.length).toBe(3);
  });

  it("classifies boundaries", () => {
    expect(classifyClimate({ ...base, heatingDegreeDays: 1500 }).heating).toBe("medium");
    expect(classifyClimate({ ...base, heatingDegreeDays: 1499 }).heating).toBe("low");
    expect(classifyClimate({ ...base, meanHumidityPct: 59 }).humidity).toBe("dry");
    expect(classifyClimate({ ...base, winterSunshineHours: 3.5 }).winterLight).toBe("high");
  });
});

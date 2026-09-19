import { describe, expect, it, vi } from "vitest";
import { climatePeriod, type FetchFn, fetchDailyClimate, geocodeCity, OpenMeteoError } from "./open-meteo";

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("geocodeCity", () => {
  it("returns the first result with a label", async () => {
    const fetchFn = vi.fn<FetchFn>(async () =>
      jsonResponse({ results: [{ name: "Berlin", latitude: 52.52, longitude: 13.41, admin1: "Land Berlin", timezone: "Europe/Berlin" }] }),
    );
    const loc = await geocodeCity(" Berlin ", "de", fetchFn);
    expect(loc).toEqual({ lat: 52.52, lng: 13.41, label: "Berlin, Land Berlin, DE", timezone: "Europe/Berlin" });
    const url = new URL(String(fetchFn.mock.calls[0]?.[0]));
    expect(url.searchParams.get("name")).toBe("Berlin");
    expect(url.searchParams.get("countryCode")).toBe("DE");
  });

  it("returns null when nothing is found", async () => {
    expect(await geocodeCity("Nowhere", "DE", async () => jsonResponse({ generationtime_ms: 0.1 }))).toBeNull();
  });

  it("throws on HTTP errors and bad payloads", async () => {
    await expect(geocodeCity("Berlin", "DE", async () => jsonResponse({}, 500))).rejects.toBeInstanceOf(OpenMeteoError);
    await expect(geocodeCity("Berlin", "DE", async () => jsonResponse({ results: [{ name: 1 }] }))).rejects.toBeInstanceOf(OpenMeteoError);
  });
});

describe("climatePeriod", () => {
  it("covers the last 10 full years", () => {
    expect(climatePeriod(new Date("2026-09-20T00:00:00Z"))).toEqual({ from: "2016-01-01", to: "2025-12-31" });
  });
});

describe("fetchDailyClimate", () => {
  const daily = {
    time: ["2025-01-01", "2025-07-01"],
    temperature_2m_mean: [1.5, null],
    relative_humidity_2m_mean: [85, 60],
    daylight_duration: [28000, 58000],
    sunshine_duration: [3000, 40000],
  };

  it("maps the archive response", async () => {
    const fetchFn = vi.fn<FetchFn>(async () => jsonResponse({ daily }));
    const d = await fetchDailyClimate(52.52, 13.41, { from: "2025-01-01", to: "2025-12-31" }, fetchFn);
    expect(d.temperatureMeanC).toEqual([1.5, null]);
    expect(d.sunshineSeconds[1]).toBe(40000);
    const url = new URL(String(fetchFn.mock.calls[0]?.[0]));
    expect(url.searchParams.get("daily")).toContain("sunshine_duration");
  });

  it("rejects empty or malformed data", async () => {
    await expect(fetchDailyClimate(0, 0, { from: "a", to: "b" }, async () => jsonResponse({ daily: { ...daily, time: [] } }))).rejects.toThrow(/No climate data/);
    await expect(fetchDailyClimate(0, 0, { from: "a", to: "b" }, async () => jsonResponse({ error: true, reason: "x" }))).rejects.toBeInstanceOf(OpenMeteoError);
  });
});

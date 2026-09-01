import { describe, expect, it } from "vitest";
import { samplePrototypeData } from "./fixtures";
import {
  loadBlockFeeds,
  transformAir,
  transformEarthquakes,
  transformGames,
  transformMarkets,
  transformNews,
  transformSurf,
  transformWeather,
} from "./feeds";

describe("block feed transformations", () => {
  it("normalizes weather and air-quality payloads", () => {
    const times = ["2026-08-28T09:00", "2026-08-28T14:00", "2026-08-28T19:00"];
    const weather = transformWeather({
      current: { weather_code: 2, time: "2026-08-28T07:00" },
      hourly: { time: times, temperature_2m: [61, 74, 66], weather_code: [0, 2, 3] },
      daily: { time: ["2026-08-28"], temperature_2m_max: [74], temperature_2m_min: [58], precipitation_probability_max: [35], uv_index_max: [6.2], sunset: ["2026-08-28T19:43"] },
    });
    expect(weather.points.map((point) => point.temperature)).toEqual([61, 74, 66]);
    expect(weather.sunset).toMatch(/7:43 PM/);
    expect(transformAir({ current: { us_aqi: 42, pm2_5: 8.4, uv_index: 4.2 } })).toMatchObject({ label: "Good", pm25: 8.4 });
  });

  it("normalizes marine, games, FX, news, and earthquake payloads", () => {
    expect(transformSurf({ hourly: { time: ["2026-08-28T07:00", "2026-08-28T08:00", "2026-08-28T09:00", "2026-08-28T10:00", "2026-08-28T11:00", "2026-08-28T12:00", "2026-08-28T13:00", "2026-08-28T14:00", "2026-08-28T15:00", "2026-08-28T16:00", "2026-08-28T17:00", "2026-08-28T18:00", "2026-08-28T19:00"], wave_height: Array(13).fill(0.8), wave_period: Array(13).fill(9), wave_direction: Array(13).fill(180) } }).windows[0]).toMatchObject({ height: 2.6, direction: "S" });
    expect(transformGames({ events: [{ strLeague: "WNBA", strAwayTeam: "Liberty", strHomeTeam: "Storm", intAwayScore: "88", intHomeScore: "90", strStatus: "Final" }] }).games[0]).toMatchObject({ awayScore: 88, status: "Final" });
    expect(transformMarkets([
      { quote: "EUR", rate: 0.85 }, { quote: "EUR", rate: 0.86 },
      { quote: "GBP", rate: 0.73 }, { quote: "GBP", rate: 0.74 },
    ]).rows).toHaveLength(2);
    expect(transformNews([{ title: "Useful story", url: "https://example.com/story", score: 12, time: 1_787_880_000 }], new Date("2026-08-28T04:00:00Z")).stories[0].source).toBe("example.com");
    expect(transformEarthquakes({ features: [{ properties: { mag: 5.2, place: "Test place", time: Date.parse("2026-08-28T03:00:00Z") }, geometry: { coordinates: [0, 0, 12] } }] }, new Date("2026-08-28T04:00:00Z")).events[0]).toMatchObject({ magnitude: 5.2, depth: 12 });
  });

  it("rejects malformed or empty payloads", () => {
    expect(() => transformWeather({})).toThrow();
    expect(() => transformAir({ current: {} })).toThrow();
    expect(() => transformSurf({ hourly: { time: [], wave_height: [] } })).toThrow();
    expect(() => transformGames({ events: [] })).toThrow();
    expect(() => transformMarkets([])).toThrow();
    expect(() => transformNews([], new Date())).toThrow();
    expect(() => transformEarthquakes({ features: [] }, new Date())).toThrow();
  });

  it("falls back atomically per failed public feed", async () => {
    const fetcher = (async () => new Response("Unavailable", { status: 503 })) as typeof fetch;
    const result = await loadBlockFeeds({ name: "Fallback City", latitude: 12.345, longitude: 67.89, timezone: "UTC" }, { fetcher, now: new Date("2026-08-28T04:00:00Z"), timeoutMs: 20 });
    expect(result.states.weather).toBe("sample-fallback");
    expect(result.states.news).toBe("sample-fallback");
    expect(result.states.agenda).toBe("sample");
    expect(result.data.weather).toEqual(samplePrototypeData.weather);
  });

  it("propagates caller cancellation instead of presenting stale fallback data", async () => {
    const fetcher = ((_: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })) as typeof fetch;
    const controller = new AbortController();
    const pending = loadBlockFeeds({ name: "Abort City", latitude: -12.345, longitude: -67.89, timezone: "UTC" }, { fetcher, signal: controller.signal, timeoutMs: 10_000 });
    controller.abort();
    await expect(pending).rejects.toThrow();
  });

  it("times out stalled public feeds and labels their fixtures as fallbacks", async () => {
    const fetcher = ((_: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    })) as typeof fetch;
    const result = await loadBlockFeeds({ name: "Timeout City", latitude: 23.456, longitude: 78.901, timezone: "UTC" }, {
      fetcher,
      now: new Date("2026-08-28T04:00:00Z"),
      timeoutMs: 5,
    });
    expect(result.states.weather).toBe("sample-fallback");
    expect(result.states.earthquakes).toBe("sample-fallback");
    expect(result.data.weather).toEqual(samplePrototypeData.weather);
  });
});

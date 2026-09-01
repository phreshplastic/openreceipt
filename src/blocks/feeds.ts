import { createSampleSnapshot, newYorkLocation } from "./fixtures";
import type {
  AirData,
  EarthquakeData,
  FeedSnapshot,
  GamesData,
  MarketsData,
  NewsData,
  PreviewLocation,
  PrototypeBlockId,
  SurfData,
  WeatherData,
} from "./types";

type Fetcher = typeof fetch;
export type LoadOptions = { fetcher?: Fetcher; signal?: AbortSignal; now?: Date; timeoutMs?: number };

const CACHE_MS = 10 * 60 * 1_000;
const cache = new Map<string, { expires: number; snapshot: FeedSnapshot }>();

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object response.");
  return value as Record<string, unknown>;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Expected an array response.");
  return value;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value: number, digits = 0) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function clock(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isFinite(date.getTime())) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const [hourText, minute = "00"] = value.split(":");
  const hour = Number(hourText);
  if (!Number.isFinite(hour)) return value;
  return `${hour % 12 || 12}:${minute.slice(0, 2)} ${hour >= 12 ? "PM" : "AM"}`;
}

function ageFrom(timestamp: number, now: Date) {
  const minutes = Math.max(0, Math.round((now.getTime() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

function weatherCondition(code: number) {
  if (code === 0) return "Clear";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Foggy";
  if (code >= 51 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 95) return "Thunderstorms";
  return "Mixed conditions";
}

function compass(degrees: number) {
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return points[Math.round(((degrees % 360) + 360) % 360 / 45) % 8];
}

function daypartIndex(times: unknown[], date: string, hour: string) {
  const exact = times.findIndex((value) => text(value) === `${date}T${hour}:00`);
  return exact >= 0 ? exact : 0;
}

export function transformWeather(payload: unknown): WeatherData {
  const root = record(payload);
  const current = record(root.current);
  const hourly = record(root.hourly);
  const daily = record(root.daily);
  const times = array(hourly.time);
  const temperatures = array(hourly.temperature_2m);
  const codes = array(hourly.weather_code);
  const precipitationValues = Array.isArray(hourly.precipitation_probability) ? hourly.precipitation_probability : [];
  const date = text(array(daily.time)[0]);
  if (!date || !times.length || !temperatures.length) throw new Error("Weather response has no forecast periods.");
  const selections = [["Morning", "09"], ["Afternoon", "14"], ["Evening", "19"]] as const;
  const points = selections.map(([label, hour]) => {
    const index = daypartIndex(times, date, hour);
    return { label, temperature: Math.round(number(temperatures[index])), condition: weatherCondition(number(codes[index])) };
  });
  const precipitation = Math.round(number(array(daily.precipitation_probability_max)[0]));
  const high = Math.round(number(array(daily.temperature_2m_max)[0]));
  const low = Math.round(number(array(daily.temperature_2m_min)[0]));
  const condition = weatherCondition(number(current.weather_code));
  const trendIndexes = times.map((value, index) => ({ value: text(value), index })).filter(({ value }) => {
    if (!value.startsWith(`${date}T`)) return false;
    const hour = Number(value.slice(11, 13));
    return hour >= 6 && hour <= 20 && hour % 2 === 0;
  }).slice(0, 8).map(({ index }) => index);
  const selectedTrendIndexes = trendIndexes.length >= 4 ? trendIndexes : selections.map(([, hour]) => daypartIndex(times, date, hour));
  const summary = precipitation >= 50
    ? `Rain is likely later. High ${high}°, with a low near ${low}°.`
    : precipitation >= 25
      ? `A small chance of rain later. High ${high}°, low ${low}°.`
      : `A mostly dry day ahead. High ${high}°, with a low near ${low}°.`;
  return {
    condition,
    summary,
    points,
    precipitation,
    uv: round(number(array(daily.uv_index_max)[0]), 1),
    sunset: clock(text(array(daily.sunset)[0])),
    updated: clock(text(current.time)),
    temperatureTrend: selectedTrendIndexes.map((index) => round(number(temperatures[index]), 1)),
    precipitationTrend: selectedTrendIndexes.map((index) => round(number(precipitationValues[index], precipitation), 1)),
  };
}

export function transformAir(payload: unknown): AirData {
  const current = record(record(payload).current);
  const aqi = Math.round(number(current.us_aqi, -1));
  if (aqi < 0) throw new Error("Air-quality response has no AQI.");
  const label = aqi <= 50 ? "Good" : aqi <= 100 ? "Moderate" : aqi <= 150 ? "Sensitive groups" : aqi <= 200 ? "Unhealthy" : "Very unhealthy";
  return {
    aqi,
    label,
    pm25: round(number(current.pm2_5), 1),
    uv: round(number(current.uv_index), 1),
    outlook: aqi <= 50 ? "Good air for time outside." : aqi <= 100 ? "Air is acceptable for most people." : "Consider reducing prolonged outdoor activity.",
  };
}

export function transformSurf(payload: unknown): SurfData {
  const hourly = record(record(payload).hourly);
  const times = array(hourly.time);
  const heights = array(hourly.wave_height);
  const periods = array(hourly.wave_period);
  const directions = array(hourly.wave_direction);
  if (times.length < 3 || heights.length < 3) throw new Error("Marine response has no forecast windows.");
  const indexes = [0, Math.min(6, times.length - 1), Math.min(12, times.length - 1)];
  const windows = indexes.map((index) => ({
    time: clock(text(times[index])),
    height: round(number(heights[index]) * 3.28084, 1),
    period: Math.round(number(periods[index])),
    direction: compass(number(directions[index])),
  }));
  const strongest = windows.reduce((best, value) => value.height > best.height ? value : best);
  return {
    location: "Rockaway Beach",
    windows,
    summary: `Best size near ${strongest.time}. Conditions stay ${strongest.height < 3 ? "small" : "rideable"} through the day.`,
    heightTrend: heights.slice(0, 18).filter((_, index) => index % 2 === 0).map((height) => round(number(height) * 3.28084, 1)),
  };
}

export function transformGames(payload: unknown): GamesData {
  const events = array(record(payload).events).slice(0, 3).map((value) => record(value));
  if (!events.length) throw new Error("Sports response has no events.");
  const games = events.map((event) => {
    const homeScore = text(event.intHomeScore) === "" ? undefined : number(event.intHomeScore);
    const awayScore = text(event.intAwayScore) === "" ? undefined : number(event.intAwayScore);
    const status = homeScore !== undefined && awayScore !== undefined
      ? text(event.strStatus, "Final")
      : clock(text(event.strTimeLocal, text(event.strTime)));
    return { away: text(event.strAwayTeam, "Away"), home: text(event.strHomeTeam, "Home"), awayScore, homeScore, status };
  });
  return { league: text(events[0].strLeague, "Today’s games"), games };
}

export function transformMarkets(payload: unknown): MarketsData {
  const rates = array(payload).map((value) => record(value));
  if (!rates.length) throw new Error("Market response has no rates.");
  const symbols = [...new Set(rates.map((rate) => text(rate.quote)).filter(Boolean))].slice(0, 3);
  const rows = symbols.map((symbol) => {
    const values = rates.filter((rate) => text(rate.quote) === symbol).map((rate) => number(rate.rate)).filter((value) => value > 0).slice(-5);
    if (values.length < 2) throw new Error(`Market response has too little history for ${symbol}.`);
    const value = values.at(-1)!;
    const previous = values.at(-2)!;
    return { symbol, value, change: round((value - previous) / previous * 100, 2), history: values };
  });
  return { base: `USD market pulse`, rows };
}

export function transformNews(items: unknown[], now: Date): NewsData {
  const stories = items.map((item) => record(item)).filter((item) => text(item.title)).slice(0, 3).map((item) => {
    const url = text(item.url);
    let source = "news.ycombinator.com";
    try { if (url) source = new URL(url).hostname.replace(/^www\./, ""); } catch { /* use HN */ }
    return { title: text(item.title), source, score: Math.round(number(item.score)), age: ageFrom(number(item.time) * 1_000, now) };
  });
  if (!stories.length) throw new Error("News response has no stories.");
  return { stories };
}

export function transformEarthquakes(payload: unknown, now: Date): EarthquakeData {
  const events = array(record(payload).features).map((value) => record(value)).map((feature) => {
    const properties = record(feature.properties);
    const coordinates = array(record(feature.geometry).coordinates);
    return {
      magnitude: round(number(properties.mag), 1),
      place: text(properties.place, "Unknown location"),
      depth: Math.round(number(coordinates[2])),
      age: ageFrom(number(properties.time), now),
    };
  }).sort((a, b) => b.magnitude - a.magnitude).slice(0, 3);
  if (!events.length) throw new Error("Earthquake response has no events.");
  return { events };
}

async function fetchJson(url: string, fetcher: Fetcher, outerSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const abort = () => controller.abort(outerSignal?.reason);
  outerSignal?.addEventListener("abort", abort, { once: true });
  const timeout: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), timeoutMs);
  try {
    const response = await fetcher(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Feed request failed (${response.status}).`);
    return await response.json() as unknown;
  } finally {
    clearTimeout(timeout);
    outerSignal?.removeEventListener("abort", abort);
  }
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function loadWeather(location: PreviewLocation, unit: "fahrenheit" | "celsius" = "fahrenheit", options: LoadOptions = {}) {
  const timezone = encodeURIComponent(location.timezone || "auto");
  const temperatureUnit = unit === "celsius" ? "celsius" : "fahrenheit";
  const payload = await fetchJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,apparent_temperature,weather_code&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunset&timezone=${timezone}&forecast_days=2&temperature_unit=${temperatureUnit}`,
    options.fetcher ?? fetch,
    options.signal,
    options.timeoutMs ?? 5_000,
  );
  return transformWeather(payload);
}

async function loadNews(fetcher: Fetcher, signal: AbortSignal | undefined, timeoutMs: number, now: Date) {
  const ids = array(await fetchJson("https://hacker-news.firebaseio.com/v0/topstories.json", fetcher, signal, timeoutMs)).slice(0, 5);
  const items = await Promise.all(ids.map((id) => fetchJson(`https://hacker-news.firebaseio.com/v0/item/${number(id)}.json`, fetcher, signal, timeoutMs)));
  return transformNews(items, now);
}

export async function loadTopStories(options: LoadOptions = {}): Promise<NewsData> {
  return loadNews(options.fetcher ?? fetch, options.signal, options.timeoutMs ?? 5_000, options.now ?? new Date());
}

export async function loadAir(location: PreviewLocation, options: LoadOptions = {}): Promise<AirData> {
  const timezone = encodeURIComponent(location.timezone || "auto");
  return transformAir(await fetchJson(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.latitude}&longitude=${location.longitude}&current=us_aqi,pm2_5,uv_index&timezone=${timezone}`, options.fetcher ?? fetch, options.signal, options.timeoutMs ?? 5_000));
}

export async function loadMarkets(options: LoadOptions = {}): Promise<MarketsData> {
  const now = options.now ?? new Date();
  const startDate = new Date(now);
  startDate.setUTCDate(startDate.getUTCDate() - 10);
  return transformMarkets(await fetchJson(`https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR,GBP,JPY&from=${isoDate(startDate)}&to=${isoDate(now)}`, options.fetcher ?? fetch, options.signal, options.timeoutMs ?? 5_000));
}

export async function loadBlockFeeds(location = newYorkLocation, options: LoadOptions = {}): Promise<FeedSnapshot> {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? new Date();
  const timeoutMs = options.timeoutMs ?? 5_000;
  const cacheKey = `${location.latitude.toFixed(3)}:${location.longitude.toFixed(3)}:${isoDate(now)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return structuredClone(cached.snapshot);
  const snapshot = createSampleSnapshot(location);
  const end = isoDate(now);
  const jobs: Array<[PrototypeBlockId, () => Promise<unknown>]> = [
    ["weather", async () => loadWeather(location, "fahrenheit", { ...options, fetcher, timeoutMs })],
    ["air", async () => loadAir(location, { ...options, fetcher, timeoutMs })],
    ["surf", async () => transformSurf(await fetchJson("https://marine-api.open-meteo.com/v1/marine?latitude=40.583&longitude=-73.815&hourly=wave_height,wave_period,wave_direction&timezone=America%2FNew_York&forecast_hours=18&length_unit=metric", fetcher, options.signal, timeoutMs))],
    ["games", async () => transformGames(await fetchJson(`https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${end}&s=Basketball`, fetcher, options.signal, timeoutMs))],
    ["markets", async () => loadMarkets({ ...options, fetcher, timeoutMs, now })],
    ["news", async () => loadNews(fetcher, options.signal, timeoutMs, now)],
    ["earthquakes", async () => transformEarthquakes(await fetchJson("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson", fetcher, options.signal, timeoutMs), now)],
  ];
  await Promise.all(jobs.map(async ([id, load]) => {
    try {
      snapshot.data[id] = await load() as never;
      snapshot.states[id] = "live";
    } catch (error) {
      if (options.signal?.aborted) throw error;
      snapshot.states[id] = "sample-fallback";
    }
  }));
  cache.set(cacheKey, { expires: Date.now() + CACHE_MS, snapshot: structuredClone(snapshot) });
  return snapshot;
}

export async function geocodeCity(query: string, options: LoadOptions = {}): Promise<PreviewLocation> {
  const trimmed = query.trim();
  if (!trimmed) throw new Error("Enter a city or postal code.");
  const payload = record(await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=1&language=en&format=json`, options.fetcher ?? fetch, options.signal, options.timeoutMs ?? 5_000));
  const result = record(array(payload.results)[0]);
  const latitude = number(result.latitude, Number.NaN);
  const longitude = number(result.longitude, Number.NaN);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error(`No location found for “${trimmed}”.`);
  const parts = [text(result.name), text(result.admin1), text(result.country)].filter(Boolean);
  return { name: [...new Set(parts)].join(", "), latitude, longitude, timezone: text(result.timezone, "auto") };
}

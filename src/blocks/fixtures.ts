import type { FeedSnapshot, PreviewLocation, PrototypeDataMap, PrototypeBlockId } from "./types";

export const newYorkLocation: PreviewLocation = {
  name: "New York, New York",
  latitude: 40.7128,
  longitude: -74.006,
  timezone: "America/New_York",
};

export const samplePrototypeData: PrototypeDataMap = {
  weather: {
    condition: "Partly cloudy",
    summary: "Comfortable through lunch. Light rain may arrive late afternoon.",
    points: [
      { label: "Morning", temperature: 61, condition: "Mostly clear" },
      { label: "Afternoon", temperature: 74, condition: "Partly cloudy" },
      { label: "Evening", temperature: 66, condition: "Overcast" },
    ],
    precipitation: 35,
    uv: 6,
    sunset: "7:43 PM",
    updated: "7:00 AM",
    temperatureTrend: [59, 61, 66, 71, 74, 73, 69, 66],
    precipitationTrend: [5, 5, 10, 15, 22, 35, 42, 28],
  },
  air: { aqi: 42, label: "Good", pm25: 8.4, uv: 4.2, outlook: "Clean air through the afternoon." },
  surf: {
    location: "Rockaway Beach",
    windows: [
      { time: "7 AM", height: 2.1, period: 8, direction: "SE" },
      { time: "1 PM", height: 2.8, period: 9, direction: "SSE" },
      { time: "7 PM", height: 2.4, period: 8, direction: "S" },
    ],
    summary: "Small and clean early. Onshore wind builds after lunch.",
    heightTrend: [2.1, 2.2, 2.3, 2.6, 2.8, 2.7, 2.5, 2.4],
  },
  games: {
    league: "Tonight’s games",
    games: [
      { away: "NYK", home: "BOS", awayScore: 104, homeScore: 111, status: "Final" },
      { away: "MIA", home: "BKN", status: "7:30 PM" },
      { away: "PHI", home: "MIL", status: "8:00 PM" },
    ],
  },
  markets: {
    base: "USD market pulse",
    rows: [
      { symbol: "EUR", value: 0.8562, change: 0.31, history: [0.849, 0.851, 0.85, 0.854, 0.8562] },
      { symbol: "GBP", value: 0.7391, change: -0.18, history: [0.741, 0.742, 0.74, 0.738, 0.7391] },
      { symbol: "JPY", value: 147.82, change: 0.62, history: [146.4, 146.8, 147.1, 147.6, 147.82] },
    ],
  },
  news: {
    stories: [
      { title: "A tiny computer that does one thing well", source: "example.com", score: 412, age: "2h" },
      { title: "The case for tools with a physical output", source: "paper.dev", score: 286, age: "4h" },
      { title: "Designing useful information at a glance", source: "signal.org", score: 173, age: "5h" },
    ],
  },
  earthquakes: {
    events: [
      { magnitude: 5.7, place: "South Sandwich Islands", depth: 42, age: "34m" },
      { magnitude: 4.9, place: "Near the coast of Japan", depth: 18, age: "2h" },
      { magnitude: 4.6, place: "Northern Chile", depth: 96, age: "5h" },
    ],
  },
  agenda: {
    date: "Friday · August 28",
    events: [
      { start: "9:00", end: "9:30", title: "Studio stand-up", detail: "Project room" },
      { start: "11:30", end: "12:15", title: "Dentist", detail: "Leave by 11:05" },
      { start: "3:00", title: "Pick up dry cleaning" },
      { start: "7:30", title: "Dinner with Maya", detail: "Rule of Thirds" },
    ],
  },
  departures: {
    station: "Atlantic Terminal",
    rows: [
      { time: "7:42", destination: "Babylon", platform: "6", status: "On time" },
      { time: "7:51", destination: "Hempstead", platform: "3", status: "+4 min" },
      { time: "8:03", destination: "Far Rockaway", platform: "1", status: "Boarding" },
      { time: "8:12", destination: "Long Beach", platform: "5", status: "On time" },
    ],
  },
  home: {
    headline: "Home is settled",
    rows: [
      { label: "Front door", value: "Locked", state: "normal" },
      { label: "Windows", value: "1 open", state: "attention" },
      { label: "Inside", value: "72°F", state: "normal" },
      { label: "Energy today", value: "8.4 kWh", state: "normal" },
    ],
    energyHistory: [0.4, 0.3, 0.5, 0.8, 1.4, 0.9, 1.7, 1.2, 0.8],
  },
  habit: {
    title: "Weekly habits",
    period: "Week of __________",
    rows: [
      { label: "Exercise", values: [2, 1, 1, 1, 1, 1, 1] },
      { label: "Water", values: [2, 2, 1, 1, 1, 1, 1] },
      { label: "Read", values: [1, 1, 1, 1, 1, 1, 1] },
      { label: "Stretch", values: [2, 1, 1, 1, 1, 1, 1] },
      { label: "Early bed", values: [1, 1, 1, 1, 1, 1, 1] },
    ],
  },
  dailyPlan: { dateLabel: "DATE  __________" },
  groupedChecklist: { dateLabel: "DATE  __________" },
  workoutLog: { dateLabel: "DATE  __________" },
  weatherJournal: { dateLabel: "LOCATION  __________" },
  mealPlan: { dateLabel: "DATE  __________" },
  meetingNotes: { dateLabel: "DATE  __________" },
  packingList: { dateLabel: "LEAVING  __________" },
  delivery: {
    carrier: "UPS · 1Z 849 03",
    status: "Out for delivery",
    eta: "2:15–4:15 PM",
    progress: 0.76,
    checkpoints: [
      { label: "Shipped", complete: true },
      { label: "Brooklyn", complete: true },
      { label: "Your stop", complete: false },
    ],
  },
  countdown: {
    label: "Next up",
    event: "Summer trip",
    date: "September 18 · 8:20 AM",
    days: 21,
    milestones: [
      { label: "Booked", complete: true },
      { label: "Pack", complete: false },
      { label: "Go", complete: false },
    ],
  },
  checklistGroups: {
    title: "Lisbon, four days",
    note: "Thu departure",
    groups: [
      { name: "Carry-on", items: [{ text: "Passport", checked: true }, { text: "Charger and adapter", checked: false }, { text: "Headphones", checked: false }] },
      { name: "Clothes", items: [{ text: "Rain shell", checked: false }, { text: "Walking shoes", checked: true }] },
      { name: "Before the door", items: [{ text: "Bins out", checked: false }, { text: "Thermostat down", checked: false }] },
    ],
  },
};

export function createSampleSnapshot(location = newYorkLocation): FeedSnapshot {
  return {
    location,
    data: structuredClone(samplePrototypeData),
    states: Object.fromEntries((Object.keys(samplePrototypeData) as PrototypeBlockId[]).map((id) => [id, ["weather", "air", "surf", "games", "markets", "news", "earthquakes"].includes(id) ? "loading" : "sample"])) as FeedSnapshot["states"],
  };
}

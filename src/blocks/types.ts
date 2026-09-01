export type PrototypeBlockId =
  | "weather"
  | "air"
  | "surf"
  | "games"
  | "markets"
  | "news"
  | "earthquakes"
  | "agenda"
  | "departures"
  | "home"
  | "habit"
  | "dailyPlan"
  | "workoutLog"
  | "weatherJournal"
  | "mealPlan"
  | "meetingNotes"
  | "packingList"
  | "delivery"
  | "countdown"
  | "checklistGroups";

export type PrototypeCategory = "Daily" | "Live data" | "Write-in" | "Getting around" | "Home & life";
export type PaperWidthDots = 576 | 420;
export type DataState = "live" | "sample" | "sample-fallback" | "loading";

export type PreviewLocation = {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type WeatherData = {
  condition: string;
  summary: string;
  points: Array<{ label: string; temperature: number; condition: string }>;
  precipitation: number;
  uv: number;
  sunset: string;
  updated: string;
  temperatureTrend: number[];
  precipitationTrend: number[];
  /** Where these numbers are from, so two forecasts never share a heading. */
  place?: string;
};

export type AirData = {
  aqi: number;
  label: string;
  pm25: number;
  uv: number;
  outlook: string;
  place?: string;
};

export type SurfData = {
  location: string;
  windows: Array<{ time: string; height: number; period: number; direction: string }>;
  summary: string;
  heightTrend: number[];
};

export type GamesData = {
  league: string;
  games: Array<{ away: string; home: string; awayScore?: number; homeScore?: number; status: string }>;
};

export type MarketsData = {
  base: string;
  rows: Array<{ symbol: string; value: number; change: number; history: number[] }>;
};

export type NewsData = {
  stories: Array<{ title: string; source: string; score: number; age: string }>;
};

export type EarthquakeData = {
  events: Array<{ magnitude: number; place: string; depth: number; age: string }>;
};

export type AgendaData = {
  date: string;
  events: Array<{ start: string; end?: string; title: string; detail?: string }>;
};

export type DeparturesData = {
  station: string;
  rows: Array<{ time: string; destination: string; platform: string; status: string }>;
};

export type HomeData = {
  headline: string;
  rows: Array<{ label: string; value: string; state: "normal" | "attention" }>;
  energyHistory: number[];
};

export type HabitData = {
  title: string;
  period: string;
  rows: Array<{ label: string; values: Array<0 | 1 | 2> }>;
};

export type WriteInData = {
  dateLabel: string;
  title?: string;
  prioritiesLabel?: string;
  scheduleLabel?: string;
  rememberLabel?: string;
};

export type MealPlanData = {
  dateLabel: string;
  meals: Array<{ id: string; name: string; dishes: Array<{ id: string; text: string; detail?: string }> }>;
  prep: Array<{ id: string; text: string; checked: boolean }>;
};

export type MeetingNotesData = {
  dateLabel: string;
  topic?: string;
  attendees?: string;
  decisions: Array<{ id: string; text: string }>;
  actions: Array<{ id: string; text: string; owner?: string; due?: string; done: boolean }>;
};

export type WorkoutLogData = {
  dateLabel: string;
  focus?: string;
  duration?: string;
  exercises: Array<{ id: string; name: string; sets?: string; reps?: string; load?: string }>;
};

export type DeliveryData = {
  carrier: string;
  status: string;
  eta: string;
  progress: number;
  checkpoints: Array<{ label: string; complete: boolean }>;
};

export type ChecklistGroupsData = {
  title: string;
  note?: string;
  groups: Array<{ name: string; items: Array<{ text: string; checked: boolean }> }>;
};

export type CountdownData = {
  label: string;
  event: string;
  date: string;
  days: number;
  milestones: Array<{ label: string; complete: boolean }>;
};

export type PrototypeDataMap = {
  weather: WeatherData;
  air: AirData;
  surf: SurfData;
  games: GamesData;
  markets: MarketsData;
  news: NewsData;
  earthquakes: EarthquakeData;
  agenda: AgendaData;
  departures: DeparturesData;
  home: HomeData;
  habit: HabitData;
  dailyPlan: WriteInData;
  workoutLog: WorkoutLogData;
  weatherJournal: WriteInData;
  mealPlan: MealPlanData;
  meetingNotes: MeetingNotesData;
  packingList: WriteInData;
  delivery: DeliveryData;
  countdown: CountdownData;
  checklistGroups: ChecklistGroupsData;
};

export type FeedSnapshot = {
  location: PreviewLocation;
  data: PrototypeDataMap;
  states: Record<PrototypeBlockId, DataState>;
};

export type RenderedPrototype = {
  svg: string;
  width: PaperWidthDots;
  height: number;
};

export type BlockPrototype = {
  id: PrototypeBlockId;
  name: string;
  category: PrototypeCategory;
  description: string;
  designNote: string;
  sourceName?: string;
  sourceUrl?: string;
};

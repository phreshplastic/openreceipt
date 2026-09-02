import {
  Activity,
  CalendarClock,
  CloudSun,
  Dumbbell,
  Grid3x3,
  House,
  ListChecks,
  ListTodo,
  Luggage,
  Newspaper,
  NotebookPen,
  Package,
  Stamp,
  ThermometerSun,
  Timer,
  TrainFront,
  TrendingUp,
  Trophy,
  UtensilsCrossed,
  WavesHorizontal,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { PrototypeBlockId } from "../blocks/types";

const libraryGlyphs = {
  logo: Stamp,
  weather: CloudSun,
  air: Wind,
  surf: WavesHorizontal,
  games: Trophy,
  markets: TrendingUp,
  news: Newspaper,
  earthquakes: Activity,
  agenda: CalendarClock,
  departures: TrainFront,
  home: House,
  habit: Grid3x3,
  dailyPlan: ListTodo,
  workoutLog: Dumbbell,
  weatherJournal: ThermometerSun,
  mealPlan: UtensilsCrossed,
  meetingNotes: NotebookPen,
  packingList: Luggage,
  delivery: Package,
  countdown: Timer,
  checklistGroups: ListChecks,
} satisfies Record<PrototypeBlockId, LucideIcon>;

export function LibraryGlyph({ id, size = 18 }: { id: PrototypeBlockId; size?: number }) {
  const Icon = libraryGlyphs[id];
  return <span className="library-glyph" aria-hidden="true"><Icon size={size} /></span>;
}

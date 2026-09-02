import { collections, editableFields } from "../receipt/collections";
import type { DraftBlockType } from "./schema";

export type BlockVocabularyEntry = {
  type: DraftBlockType;
  live: boolean;
  /** Short enough that the whole vocabulary fits inside one tool response. */
  whenToUse: string;
  needs: string;
  /** Which collection edit_receipt's line operations reach, when there is one. */
  collection?: string;
};

export const blockVocabulary: BlockVocabularyEntry[] = [
  { type: "heading", live: false, whenToUse: "Name the receipt or open a section.", needs: "text; size display|heading|section" },
  { type: "text", live: false, whenToUse: "A sentence of context, an instruction, a note.", needs: "text; size small|body|large" },
  { collection: "checklist", type: "list", live: false, whenToUse: "A flat set of things to tick off.", needs: "items: string[] or {text,checked}[]" },
  { collection: "checklistGroups", type: "groups", live: false, whenToUse: "A packing or shopping list sorted into named sections. The workhorse for trips.", needs: "title, groups:[{name, items}]" },
  { collection: "keyValue", type: "facts", live: false, whenToUse: "Label/value pairs: flight number, seat, confirmation code, address.", needs: "rows:[{label,value,emphasis?}]" },
  { collection: "table", type: "table", live: false, whenToUse: "Two or three aligned columns of short values.", needs: "header?, rows: string[][]" },
  { collection: "countdown", type: "countdown", live: false, whenToUse: "One big number for something being anticipated.", needs: "event, date, days, milestones?" },
  { collection: "agenda", type: "agenda", live: false, whenToUse: "A timed run of the day.", needs: "events:[{start,end?,title,detail?}]" },
  { collection: "habit", type: "habits", live: false, whenToUse: "A week-by-day grid to mark by hand.", needs: "habits: string[]" },
  { type: "rule", live: false, whenToUse: "Separate two unrelated sections.", needs: "style solid|dashed" },
  { type: "weather", live: true, whenToUse: "Forecast for a place. Use the destination for travel.", needs: "city; unit?" },
  { type: "air", live: true, whenToUse: "Air quality and UV for a place.", needs: "city" },
  { type: "news", live: true, whenToUse: "Five top stories, for a morning brief.", needs: "nothing" },
  { type: "markets", live: true, whenToUse: "USD exchange rates with sparklines.", needs: "nothing" },
  { type: "surf", live: true, whenToUse: "Wave height and wind for a coastal spot.", needs: "city (a break or coastal town)" },
  { type: "games", live: true, whenToUse: "Today's fixtures for one sport.", needs: "league? Basketball|Soccer|Baseball|Ice Hockey" },
  { type: "quakes", live: true, whenToUse: "Magnitude 4.5+ worldwide in the past day.", needs: "nothing" },
  { type: "form", live: false, whenToUse: "A blank ruled form to fill in with a pen; carries no content.", needs: "form: dailyPlan|packingList|weatherJournal (blank) or mealPlan|meetingNotes|workoutLog (fill with addItem)" },
  { type: "logo", live: false, whenToUse: "The shop sign at the top of a receipt. One per receipt, first block. Leave the existing one alone unless asked.", needs: "name; tagline?; mark? owners-printer-western|kitchen-dispatch|masthead-press|mono-ticket|oval-badge|block-modern" },
];

export const blockVocabularyByType = new Map(blockVocabulary.map((entry) => [entry.type, entry]));

/** The named attributes edit_receipt's `fields` accepts, per collection. Derived, never hand-listed. */
export const collectionFields: Record<string, string[]> = Object.fromEntries(
  Object.entries(collections).flatMap(([key, descriptor]) => descriptor ? [[key, editableFields(descriptor)]] : []),
);

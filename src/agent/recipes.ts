import type { DraftBlockType } from "./schema";

/**
 * Situations, not templates.
 *
 * A recipe is what the app knows about a moment in someone's life: which blocks belong on
 * the paper, in what order, and which details are worth asking for before drafting. The
 * agent supplies the intelligence; this supplies the taste.
 */
export type Recipe = {
  id: string;
  name: string;
  /** Phrases that should make an agent reach for this recipe. */
  triggers: string[];
  blocks: DraftBlockType[];
  /** What to confirm with the person before drafting. Ask briefly, then draft. */
  asks: string[];
  note: string;
};

export const recipes: Recipe[] = [
  {
    id: "travel_prep",
    name: "Trip prep",
    triggers: ["traveling", "flying", "international flight", "trip", "packing", "going away", "vacation", "abroad"],
    blocks: ["heading", "countdown", "facts", "weather", "groups", "rule", "text"],
    asks: ["destination", "departure date", "how many days", "checked bag or carry-on only"],
    note: "Weather uses the destination, not home. Group packing by where things live: carry-on, clothes, toiletries, before-the-door. Put flight number, seat and confirmation in facts.",
  },
  {
    id: "daily_brief",
    name: "Morning brief",
    triggers: ["my morning", "daily brief", "start my day", "what's today", "morning routine"],
    blocks: ["heading", "weather", "agenda", "habits", "news"],
    asks: ["city", "anything already on the calendar"],
    note: "Keep it to one arm's length of paper. Weather first, then the day, then one habit grid.",
  },
  {
    id: "reminder",
    name: "Reminder",
    triggers: ["remind me", "don't forget", "remember to", "note to self"],
    blocks: ["heading", "text", "rule", "list"],
    asks: ["what, exactly", "when"],
    note: "One heading, the when as a short line, then the message large enough to read across a room.",
  },
  {
    id: "grocery_run",
    name: "Shopping list",
    triggers: ["groceries", "shopping list", "store run", "pick up"],
    blocks: ["heading", "groups"],
    asks: ["which store", "anything already in the cart"],
    note: "Group by aisle — produce, dairy, pantry, freezer — so the list matches the walk.",
  },
  {
    id: "meeting_prep",
    name: "Meeting prep",
    triggers: ["meeting", "one on one", "standup", "call with", "interview"],
    blocks: ["heading", "facts", "list", "form"],
    asks: ["who it's with", "when", "what needs deciding"],
    note: "Print the agenda as a list and leave the meetingNotes form underneath for writing during.",
  },
  {
    id: "meal_week",
    name: "Week of meals",
    triggers: ["meal plan", "what to cook", "dinners this week", "meal prep"],
    blocks: ["heading", "table", "groups"],
    asks: ["how many nights", "anything to use up", "who's eating"],
    note: "A table of night/meal, then the shopping needed as grouped items.",
  },
  {
    id: "countdown",
    name: "Countdown",
    triggers: ["how many days", "counting down", "until my", "coming up"],
    blocks: ["countdown", "list"],
    asks: ["the event", "the date"],
    note: "The big number carries the block. Milestones are three words at most each.",
  },
  {
    id: "workout_week",
    name: "Training week",
    triggers: ["workout", "training plan", "gym", "run schedule"],
    blocks: ["heading", "table", "form"],
    asks: ["how many sessions", "what you're training for"],
    note: "Plan the week as a table, then leave a workoutLog form to fill in at the rack.",
  },
];

export const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));

/** Cheap lexical match, used only to order suggestions — the agent makes the real choice. */
export function suggestRecipes(situation: string, limit = 3): Recipe[] {
  const haystack = situation.toLowerCase();
  return recipes
    .map((recipe) => ({ recipe, score: recipe.triggers.filter((trigger) => haystack.includes(trigger)).length }))
    .filter((entry) => entry.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, limit)
    .map((entry) => entry.recipe);
}

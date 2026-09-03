import { describe, expect, it } from "vitest";
import { addChild, collectionFor, collections, removeChild, setBlockCopy, viewCollection, writeChild } from "./collections";
import { createId, receiptDocumentSchema, type ReceiptBlock } from "./model";
import { createDefaultDocument } from "./templates";

const samples: Record<string, ReceiptBlock> = {
  checklist: { id: createId(), type: "checklist", items: [{ id: createId(), text: "Passport", checked: false }, { id: createId(), text: "Charger", checked: false }] },
  keyValue: { id: createId(), type: "keyValue", dividers: false, rows: [{ id: createId(), label: "Flight", value: "TP 205", emphasis: false }] },
  table: { id: createId(), type: "table", columns: 3, header: true, rows: [{ id: createId(), cells: ["Day", "Meal", "Note"] }, { id: createId(), cells: ["Mon", "Soup", ""] }] },
  agenda: { id: createId(), type: "catalog", kind: "agenda", definitionVersion: 1, data: { date: "Monday", events: [{ id: createId(), start: "9:00", title: "Standup" }] } },
  habit: { id: createId(), type: "catalog", kind: "habit", definitionVersion: 1, data: { title: "Habits", period: "This week", rows: [{ id: createId(), label: "Stretch", values: [1, 1, 1, 1, 1, 1, 1] }] } },
  countdown: { id: createId(), type: "catalog", kind: "countdown", definitionVersion: 1, data: { label: "Next up", event: "Lisbon", date: "Thursday", days: 4, milestones: [{ label: "Booked", complete: true }, { label: "Packed", complete: false }] } },
  checklistGroups: { id: createId(), type: "catalog", kind: "checklistGroups", definitionVersion: 1, data: { title: "Packing", groups: [{ name: "Carry-on", items: [{ text: "Passport", checked: false }] }, { name: "Clothes", items: [{ text: "Jumper", checked: false }] }] } },
  mealPlan: { id: createId(), type: "catalog", kind: "mealPlan", definitionVersion: 1, data: { dateLabel: "MON", meals: [{ id: createId(), name: "Breakfast", dishes: [{ id: createId(), text: "Porridge" }] }, { id: createId(), name: "Dinner", dishes: [] }], prep: [] } },
  meetingNotes: { id: createId(), type: "catalog", kind: "meetingNotes", definitionVersion: 1, data: { dateLabel: "MON", decisions: [{ id: createId(), text: "Ship it" }], actions: [{ id: createId(), text: "Write the note", done: false }] } },
  workoutLog: { id: createId(), type: "catalog", kind: "workoutLog", definitionVersion: 1, data: { dateLabel: "MON", exercises: [{ id: createId(), name: "Bench" }] } },
};

const validate = (block: ReceiptBlock) => receiptDocumentSchema.parse({ ...createDefaultDocument(), blocks: [block] as ReceiptBlock[] });

describe("child collections", () => {
  it("covers every collection with a sample", () => {
    expect(Object.keys(samples).sort()).toEqual(Object.keys(collections).sort());
  });

  for (const [key, block] of Object.entries(samples)) {
    it(`${key}: edits one line and leaves the rest identical`, () => {
      const descriptor = collectionFor(block)!;
      const before = viewCollection(descriptor, block);
      const next = writeChild(descriptor, block, before.addresses[0], { text: "Renamed" });
      const after = viewCollection(descriptor, next);
      expect(after.keys[0]).toBe("Renamed");
      expect(after.keys.slice(1)).toEqual(before.keys.slice(1));
      validate(next);
    });

    it(`${key}: adds and removes without disturbing sibling identity`, () => {
      const descriptor = collectionFor(block)!;
      const ids = (candidate: ReceiptBlock): string[] => JSON.stringify(candidate).match(/"id":"[^"]+"/g) ?? [];
      const added = addChild(descriptor, block, { text: "Fresh line" });
      expect(viewCollection(descriptor, added).keys).toContain("Fresh line");
      expect(ids(block).every((id) => ids(added).includes(id))).toBe(true);
      validate(added);

      const view = viewCollection(descriptor, added);
      const removed = removeChild(descriptor, added, view.addresses.at(-1)!);
      expect(viewCollection(descriptor, removed).keys).not.toContain("Fresh line");
      validate(removed);
    });
  }

  it("finds an item across groups without being told which group", () => {
    const block = samples.checklistGroups;
    const descriptor = collectionFor(block)!;
    const view = viewCollection(descriptor, block);
    const index = view.keys.findIndex((key) => key === "Jumper");
    const next = writeChild(descriptor, block, view.addresses[index], { checked: true });
    expect(JSON.stringify(next)).toContain('"text":"Jumper","checked":true');
    expect(JSON.stringify(next)).toContain('"text":"Passport","checked":false');
  });

  it("adds a meeting action into the named section with its owner and due date", () => {
    const block = samples.meetingNotes;
    const descriptor = collectionFor(block)!;
    const next = addChild(descriptor, block, { text: "Send the deck", group: "actions", fields: { owner: "Pete", due: "Fri" } });
    const data = (next as Extract<ReceiptBlock, { type: "catalog"; kind: "meetingNotes" }>).data;
    expect(data.actions.at(-1)).toMatchObject({ text: "Send the deck", owner: "Pete", due: "Fri" });
    expect(data.decisions).toHaveLength(1);
    validate(next);
  });

  it("marks a single day on a habit row without resizing the week", () => {
    const block = samples.habit;
    const descriptor = collectionFor(block)!;
    const next = writeChild(descriptor, block, { itemIndex: 0 }, { fields: { day: 3, mark: "done" } });
    const row = (next as Extract<ReceiptBlock, { type: "catalog"; kind: "habit" }>).data.rows[0];
    expect(row.values).toEqual([1, 1, 2, 1, 1, 1, 1]);
    validate(next);
  });

  it("refuses a field the block does not have, and says which it does", () => {
    const descriptor = collectionFor(samples.keyValue)!;
    expect(() => writeChild(descriptor, samples.keyValue, { itemIndex: 0 }, { fields: { colour: "red" } }))
      .toThrow(/No field .colour.*value, emphasis/);
  });

  it("refuses to empty a list that needs a line, naming the bound", () => {
    const descriptor = collectionFor(samples.countdown)!;
    const one = removeChild(descriptor, samples.countdown, { itemIndex: 0 });
    expect(() => removeChild(descriptor, one, { itemIndex: 0 })).toThrow(/at least 1 milestone/);
  });

  it("refuses to exceed a bound rather than failing validation later", () => {
    const descriptor = collectionFor(samples.countdown)!;
    let block = samples.countdown;
    for (let index = 0; index < 3; index += 1) block = addChild(descriptor, block, { text: `M${index}` });
    expect(() => addChild(descriptor, block, { text: "One too many" })).toThrow(/at most 5 milestones/);
  });

  it("leaves live feed blocks alone — they refresh, they do not take edits", () => {
    for (const kind of ["weather", "air", "news", "markets", "surf", "games", "earthquakes"]) {
      expect(collections[kind]).toBeUndefined();
    }
  });
});

describe("block copy", () => {
  it("rewrites a display heading without demoting it", () => {
    const heading = createDefaultDocument().blocks.find((block) => block.type === "heading");
    if (!heading || heading.type !== "heading") throw new Error("expected a heading");
    const next = setBlockCopy(heading, "Lisbon, four days");
    expect(next).toMatchObject({ type: "heading", text: "Lisbon, four days", level: heading.level, id: heading.id });
  });

  it("points a list agent at setItem instead of inventing a title", () => {
    expect(() => setBlockCopy(samples.checklist, "Passport")).toThrow(/setItem/);
  });
});

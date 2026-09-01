import { createId, type CatalogBlockKind, type CoreReceiptBlock, type ReceiptBlock } from "./model";

/**
 * What a block's editable children are. One entry per block, so a granular edit
 * never has to rewrite a whole block — which matters because a human is usually
 * typing into the same receipt at the same time.
 */

export type FieldValue = string | number | boolean;

export type ChildField<C> = {
  name: string;
  /** Names a companion field carrying the index, for fixed-length vectors. */
  indexedBy?: string;
  set(child: C, value: FieldValue, argument?: number): C;
};

export type ChildShape<C> = {
  key(child: C): string;
  create(text: string, checked: boolean): C;
  setText?(child: C, text: string): C;
  setChecked?(child: C, checked: boolean): C;
  fields?: ChildField<C>[];
};

export type Bounds = { min: number; max: number; noun: string };

type FlatSpec<B, C> = {
  layout: "flat";
  bounds: Bounds;
  child: ChildShape<C>;
  read(block: B): C[];
  write(block: B, children: C[]): B;
};

type NestedSpec<B, G, C> = {
  layout: "nested";
  items: Bounds;
  groups: Bounds;
  /** Whether groups themselves may be added or pruned, or are a fixed set. */
  openGroups: boolean;
  child: ChildShape<C>;
  readGroups(block: B): G[];
  writeGroups(block: B, groups: G[]): B;
  groupKey(group: G): string;
  readItems(group: G): C[];
  writeItems(group: G, items: C[]): G;
  createGroup?(name: string): G;
};

export type CollectionDescriptor =
  | FlatSpec<never, never>
  | NestedSpec<never, never, never>;

const flat = <B, C>(spec: FlatSpec<B, C>) => spec as unknown as CollectionDescriptor;
const nested = <B, G, C>(spec: NestedSpec<B, G, C>) => spec as unknown as CollectionDescriptor;

type Catalog<K extends CatalogBlockKind> = Extract<ReceiptBlock, { type: "catalog"; kind: K }>;
type Core<T extends CoreReceiptBlock["type"]> = Extract<CoreReceiptBlock, { type: T }>;

const catalogData = <K extends CatalogBlockKind, T>(block: Catalog<K>, data: T) => ({ ...block, data: { ...block.data, ...data } }) as Catalog<K>;

const stringField = <C>(name: string, apply: (child: C, value: string) => C): ChildField<C> =>
  ({ name, set: (child, value) => apply(child, String(value)) });

export const collections: Partial<Record<string, CollectionDescriptor>> = {
  checklist: flat<Core<"checklist">, Core<"checklist">["items"][number]>({
    layout: "flat",
    bounds: { min: 1, max: 40, noun: "item" },
    read: (block) => block.items,
    write: (block, items) => ({ ...block, items }),
    child: {
      key: (item) => item.text,
      create: (text, checked) => ({ id: createId(), text, checked }),
      setText: (item, text) => ({ ...item, text }),
      setChecked: (item, checked) => ({ ...item, checked }),
    },
  }),

  keyValue: flat<Core<"keyValue">, Core<"keyValue">["rows"][number]>({
    layout: "flat",
    bounds: { min: 1, max: 40, noun: "row" },
    read: (block) => block.rows,
    write: (block, rows) => ({ ...block, rows }),
    child: {
      key: (row) => row.label,
      create: (text) => ({ id: createId(), label: text, value: "", emphasis: false }),
      setText: (row, label) => ({ ...row, label }),
      fields: [
        stringField("value", (row, value) => ({ ...row, value })),
        { name: "emphasis", set: (row, value) => ({ ...row, emphasis: value === true || value === "true" }) },
      ],
    },
  }),

  table: flat<Core<"table">, Core<"table">["rows"][number]>({
    layout: "flat",
    bounds: { min: 1, max: 40, noun: "row" },
    read: (block) => block.rows,
    write: (block, rows) => ({ ...block, rows }),
    child: {
      key: (row) => row.cells[0] ?? "",
      create: (text) => ({ id: createId(), cells: [text, "", ""] }),
      setText: (row, text) => ({ ...row, cells: row.cells.map((cell, index) => index === 0 ? text : cell) }),
      fields: [
        stringField("col2", (row, value) => ({ ...row, cells: row.cells.map((cell, index) => index === 1 ? value : cell) })),
        stringField("col3", (row, value) => ({ ...row, cells: row.cells.map((cell, index) => index === 2 ? value : cell) })),
      ],
    },
  }),

  agenda: flat<Catalog<"agenda">, Catalog<"agenda">["data"]["events"][number]>({
    layout: "flat",
    bounds: { min: 0, max: 16, noun: "event" },
    read: (block) => block.data.events,
    write: (block, events) => catalogData(block, { events }),
    child: {
      key: (event) => event.title,
      create: (text) => ({ id: createId(), start: "9:00", title: text }),
      setText: (event, title) => ({ ...event, title }),
      fields: [
        stringField("start", (event, start) => ({ ...event, start })),
        stringField("end", (event, end) => ({ ...event, end: end || undefined })),
        stringField("detail", (event, detail) => ({ ...event, detail: detail || undefined })),
      ],
    },
  }),

  habit: flat<Catalog<"habit">, Catalog<"habit">["data"]["rows"][number]>({
    layout: "flat",
    bounds: { min: 1, max: 10, noun: "habit" },
    read: (block) => block.data.rows,
    write: (block, rows) => catalogData(block, { rows }),
    child: {
      key: (row) => row.label,
      create: (text) => ({ id: createId(), label: text, values: [1, 1, 1, 1, 1, 1, 1] }),
      setText: (row, label) => ({ ...row, label }),
      fields: [
        // `day` selects which of the seven; `mark` writes it, never resizing the vector.
        { name: "day", set: (row) => row },
        {
          name: "mark",
          indexedBy: "day",
          set: (row, value, argument) => {
            const day = Math.round(Number(argument));
            if (!Number.isFinite(day) || day < 1 || day > 7) throw new Error("Set `day` to 1-7 (Monday to Sunday) alongside `mark`.");
            const mark = value === "done" ? 2 : value === "skip" ? 0 : 1;
            return { ...row, values: row.values.map((existing, index) => index === day - 1 ? mark as 0 | 1 | 2 : existing) };
          },
        },
      ],
    },
  }),

  countdown: flat<Catalog<"countdown">, Catalog<"countdown">["data"]["milestones"][number]>({
    layout: "flat",
    bounds: { min: 1, max: 5, noun: "milestone" },
    read: (block) => block.data.milestones,
    write: (block, milestones) => catalogData(block, { milestones }),
    child: {
      key: (milestone) => milestone.label,
      create: (text, checked) => ({ label: text.slice(0, 20), complete: checked }),
      setText: (milestone, label) => ({ ...milestone, label: label.slice(0, 20) }),
      setChecked: (milestone, complete) => ({ ...milestone, complete }),
    },
  }),

  workoutLog: flat<Catalog<"workoutLog">, Catalog<"workoutLog">["data"]["exercises"][number]>({
    layout: "flat",
    bounds: { min: 0, max: 12, noun: "exercise" },
    read: (block) => block.data.exercises,
    write: (block, exercises) => catalogData(block, { exercises }),
    child: {
      key: (exercise) => exercise.name,
      create: (text) => ({ id: createId(), name: text }),
      setText: (exercise, name) => ({ ...exercise, name }),
      fields: [
        stringField("sets", (exercise, sets) => ({ ...exercise, sets: sets || undefined })),
        stringField("reps", (exercise, reps) => ({ ...exercise, reps: reps || undefined })),
        stringField("load", (exercise, load) => ({ ...exercise, load: load || undefined })),
      ],
    },
  }),

  checklistGroups: nested<Catalog<"checklistGroups">, Catalog<"checklistGroups">["data"]["groups"][number], Catalog<"checklistGroups">["data"]["groups"][number]["items"][number]>({
    layout: "nested",
    items: { min: 1, max: 20, noun: "item" },
    groups: { min: 1, max: 6, noun: "group" },
    openGroups: true,
    readGroups: (block) => block.data.groups,
    writeGroups: (block, groups) => catalogData(block, { groups }),
    groupKey: (group) => group.name,
    readItems: (group) => group.items,
    writeItems: (group, items) => ({ ...group, items }),
    createGroup: (name) => ({ name, items: [] }),
    child: {
      key: (item) => item.text,
      create: (text, checked) => ({ text, checked }),
      setText: (item, text) => ({ ...item, text }),
      setChecked: (item, checked) => ({ ...item, checked }),
    },
  }),

  // Meals are a fixed set of slots; you add dishes to them, you do not invent a fourth meal.
  mealPlan: nested<Catalog<"mealPlan">, Catalog<"mealPlan">["data"]["meals"][number], Catalog<"mealPlan">["data"]["meals"][number]["dishes"][number]>({
    layout: "nested",
    items: { min: 0, max: 6, noun: "dish" },
    groups: { min: 1, max: 5, noun: "meal" },
    openGroups: false,
    readGroups: (block) => block.data.meals,
    writeGroups: (block, meals) => catalogData(block, { meals }),
    groupKey: (meal) => meal.name,
    readItems: (meal) => meal.dishes,
    writeItems: (meal, dishes) => ({ ...meal, dishes }),
    child: {
      key: (dish) => dish.text,
      create: (text) => ({ id: createId(), text }),
      setText: (dish, text) => ({ ...dish, text }),
      fields: [stringField("detail", (dish, detail) => ({ ...dish, detail: detail || undefined }))],
    },
  }),
};

/** Decisions and actions differ enough in shape that they are two collections behind one block. */
type MeetingBlock = Catalog<"meetingNotes">;
type MeetingLine = MeetingBlock["data"]["actions"][number];
type MeetingSection = { name: string; lines: MeetingLine[] };

collections.meetingNotes = nested<MeetingBlock, MeetingSection, MeetingLine>({
  layout: "nested",
  items: { min: 0, max: 8, noun: "line" },
  groups: { min: 2, max: 2, noun: "section" },
  openGroups: false,
  readGroups: (block) => [
    { name: "Decisions", lines: block.data.decisions.map((entry) => ({ ...entry, done: false })) },
    { name: "Actions", lines: block.data.actions },
  ],
  writeGroups: (block, sections) => catalogData(block, {
    decisions: (sections[0]?.lines ?? []).map(({ id, text }) => ({ id, text })),
    actions: sections[1]?.lines ?? [],
  }),
  groupKey: (section) => section.name,
  readItems: (section) => section.lines,
  writeItems: (section, lines) => ({ ...section, lines }),
  child: {
    key: (line) => line.text,
    create: (text, checked) => ({ id: createId(), text, done: checked }),
    setText: (line, text) => ({ ...line, text }),
    setChecked: (line, done) => ({ ...line, done }),
    fields: [
      stringField("owner", (line, owner) => ({ ...line, owner: owner || undefined })),
      stringField("due", (line, due) => ({ ...line, due: due || undefined })),
    ],
  },
});

export function blockLabel(block: ReceiptBlock) {
  return block.type === "catalog" ? block.kind : block.type;
}

export function collectionFor(block: ReceiptBlock): CollectionDescriptor | undefined {
  return collections[blockLabel(block)];
}

/** The field names an agent may pass for a block, for `list_receipt_blocks` and error text. */
export function editableFields(descriptor: CollectionDescriptor): string[] {
  return (descriptor.child.fields ?? []).map((field) => field.name);
}

export type ChildAddress = { groupIndex?: number; itemIndex: number };
export type CollectionView = { noun: string; keys: string[]; addresses: ChildAddress[]; groupKeys: string[] };

type AnyDescriptor = {
  layout: "flat" | "nested";
  bounds?: Bounds;
  items?: Bounds;
  groups?: Bounds;
  openGroups?: boolean;
  child: ChildShape<unknown>;
  read?(block: unknown): unknown[];
  write?(block: unknown, children: unknown[]): unknown;
  readGroups?(block: unknown): unknown[];
  writeGroups?(block: unknown, groups: unknown[]): unknown;
  groupKey?(group: unknown): string;
  readItems?(group: unknown): unknown[];
  writeItems?(group: unknown, items: unknown[]): unknown;
  createGroup?(name: string): unknown;
};

const asAny = (descriptor: CollectionDescriptor) => descriptor as unknown as AnyDescriptor;

/** A flat, group-agnostic view, so matching an item by text works the same everywhere. */
export function viewCollection(descriptor: CollectionDescriptor, block: ReceiptBlock): CollectionView {
  const spec = asAny(descriptor);
  if (spec.layout === "flat") {
    const children = spec.read!(block);
    return { noun: spec.bounds!.noun, keys: children.map((child) => spec.child.key(child)), addresses: children.map((_, itemIndex) => ({ itemIndex })), groupKeys: [] };
  }
  const groups = spec.readGroups!(block);
  const keys: string[] = [];
  const addresses: ChildAddress[] = [];
  groups.forEach((group, groupIndex) => spec.readItems!(group).forEach((child, itemIndex) => {
    keys.push(spec.child.key(child));
    addresses.push({ groupIndex, itemIndex });
  }));
  return { noun: spec.items!.noun, keys, addresses, groupKeys: groups.map((group) => spec.groupKey!(group)) };
}

function applyFields(spec: AnyDescriptor, child: unknown, fields: Record<string, FieldValue>) {
  const available = spec.child.fields ?? [];
  let next = child;
  for (const [name, value] of Object.entries(fields)) {
    const field = available.find((candidate) => candidate.name === name);
    if (!field) throw new Error(`No field “${name}” here. Try: ${available.map((entry) => entry.name).join(", ") || "text"}.`);
    if (field.indexedBy && fields[field.indexedBy] === undefined) throw new Error(`“${name}” needs “${field.indexedBy}” alongside it.`);
    next = field.set(next, value, field.indexedBy ? Number(fields[field.indexedBy]) : undefined);
  }
  return next;
}

function check(bounds: Bounds, length: number, what: "add" | "remove") {
  if (what === "add" && length > bounds.max) throw new Error(`This block holds at most ${bounds.max} ${bounds.noun}s.`);
  if (what === "remove" && length < bounds.min) throw new Error(`This block needs at least ${bounds.min} ${bounds.noun}${bounds.min === 1 ? "" : "s"}.`);
}

function resolveGroup(spec: AnyDescriptor, groupKeys: string[], reference: number | string | undefined) {
  if (reference === undefined) return groupKeys.length - 1;
  if (typeof reference === "number") {
    if (reference < 1 || reference > groupKeys.length) throw new Error(`There is no ${spec.groups!.noun} ${reference}; there are ${groupKeys.length}.`);
    return reference - 1;
  }
  const needle = reference.trim().toLowerCase();
  const exact = groupKeys.findIndex((key) => key.trim().toLowerCase() === needle);
  if (exact >= 0) return exact;
  const partial = groupKeys.findIndex((key) => key.toLowerCase().includes(needle));
  if (partial >= 0) return partial;
  if (!spec.openGroups || !spec.createGroup) throw new Error(`No ${spec.groups!.noun} matching “${reference}”. Present: ${groupKeys.join(", ") || "none"}.`);
  return -1;
}

export type AddInput = { text: string; checked?: boolean; group?: number | string; fields?: Record<string, FieldValue> };

export function addChild(descriptor: CollectionDescriptor, block: ReceiptBlock, input: AddInput): ReceiptBlock {
  const spec = asAny(descriptor);
  const build = () => applyFields(spec, spec.child.create(input.text, input.checked ?? false), input.fields ?? {});

  if (spec.layout === "flat") {
    const children = [...spec.read!(block), build()];
    check(spec.bounds!, children.length, "add");
    return spec.write!(block, children) as ReceiptBlock;
  }

  const groups = [...spec.readGroups!(block)];
  const groupKeys = groups.map((group) => spec.groupKey!(group));
  let groupIndex = resolveGroup(spec, groupKeys, input.group);
  if (groupIndex < 0) {
    groups.push(spec.createGroup!(String(input.group)));
    check(spec.groups!, groups.length, "add");
    groupIndex = groups.length - 1;
  }
  const items = [...spec.readItems!(groups[groupIndex]), build()];
  check(spec.items!, items.length, "add");
  groups[groupIndex] = spec.writeItems!(groups[groupIndex], items);
  return spec.writeGroups!(block, groups) as ReceiptBlock;
}

export type WriteInput = { text?: string; checked?: boolean; fields?: Record<string, FieldValue> };

function editChild(spec: AnyDescriptor, child: unknown, input: WriteInput) {
  let next = child;
  if (input.text !== undefined) {
    if (!spec.child.setText) throw new Error("This block's lines have no text to set.");
    next = spec.child.setText(next, input.text);
  }
  if (input.checked !== undefined) {
    if (!spec.child.setChecked) throw new Error("These lines cannot be ticked off.");
    next = spec.child.setChecked(next, input.checked);
  }
  return applyFields(spec, next, input.fields ?? {});
}

export function writeChild(descriptor: CollectionDescriptor, block: ReceiptBlock, at: ChildAddress, input: WriteInput): ReceiptBlock {
  const spec = asAny(descriptor);
  if (spec.layout === "flat") {
    const children = spec.read!(block).map((child, index) => index === at.itemIndex ? editChild(spec, child, input) : child);
    return spec.write!(block, children) as ReceiptBlock;
  }
  const groups = spec.readGroups!(block).map((group, groupIndex) => groupIndex !== at.groupIndex ? group
    : spec.writeItems!(group, spec.readItems!(group).map((child, index) => index === at.itemIndex ? editChild(spec, child, input) : child)));
  return spec.writeGroups!(block, groups) as ReceiptBlock;
}

export function removeChild(descriptor: CollectionDescriptor, block: ReceiptBlock, at: ChildAddress): ReceiptBlock {
  const spec = asAny(descriptor);
  if (spec.layout === "flat") {
    const children = spec.read!(block).filter((_, index) => index !== at.itemIndex);
    check(spec.bounds!, children.length, "remove");
    return spec.write!(block, children) as ReceiptBlock;
  }
  let groups = spec.readGroups!(block).map((group, groupIndex) => groupIndex !== at.groupIndex ? group
    : spec.writeItems!(group, spec.readItems!(group).filter((_, index) => index !== at.itemIndex)));
  if (spec.openGroups) groups = groups.filter((group) => spec.readItems!(group).length);
  check(spec.groups!, groups.length, "remove");
  const total = groups.reduce<number>((count, group) => count + spec.readItems!(group).length, 0);
  if (spec.openGroups) check(spec.items!, total, "remove");
  return spec.writeGroups!(block, groups) as ReceiptBlock;
}

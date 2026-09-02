import { receiptDocumentSchema, renderReceiptSvg, type ReceiptDocumentV2, type RenderedReceipt } from "../receipt";

const page = { paperWidthMm: 80 as const, printableWidthDots: 576 as const, paddingDots: 28 };
let nextDemoId = 1;

function createId() {
  const suffix = String(nextDemoId++).padStart(12, "0");
  return `00000000-0000-4000-8000-${suffix}`;
}

function doc(title: string, blocks: ReceiptDocumentV2["blocks"]): ReceiptDocumentV2 {
  return receiptDocumentSchema.parse({ schemaVersion: 2, id: createId(), title, page, blocks });
}

function heroSlip(): ReceiptDocumentV2 {
  return doc("Morning brief", [
    { id: createId(), type: "heading", text: "Morning brief", level: "display", weight: "bold", italic: false, underline: false, align: "left" },
    { id: createId(), type: "text", text: "Friday, August 21", size: "small", weight: "medium", italic: false, underline: false, align: "left" },
    {
      id: createId(), type: "catalog", kind: "weather", definitionVersion: 1,
      config: { location: { name: "New York", latitude: 40.71, longitude: -74.01, timezone: "America/New_York" }, unit: "fahrenheit" },
      data: {
        condition: "Partly cloudy",
        summary: "Jacket off after coffee. A shower possible later.",
        points: [
          { label: "Morning", temperature: 61, condition: "Mostly clear" },
          { label: "Afternoon", temperature: 74, condition: "Partly cloudy" },
          { label: "Evening", temperature: 66, condition: "Overcast" },
        ],
        precipitation: 35,
        uv: 6,
        sunset: "7:43 PM",
        updated: "11:35 AM",
        temperatureTrend: [61, 64, 68, 72, 74, 73, 70, 66],
        precipitationTrend: [5, 5, 10, 15, 35, 30, 20, 10],
        place: "New York",
      },
      refreshedAt: "2026-08-21T11:35:00.000Z",
      stale: false,
    },
    { id: createId(), type: "divider", style: "dashed" },
    {
      id: createId(), type: "catalog", kind: "agenda", definitionVersion: 1,
      data: {
        date: "Today",
        events: [
          { id: createId(), start: "8:40 AM", title: "Coffee, then the lab" },
          { id: createId(), start: "1:00 PM", title: "Walk the river path" },
          { id: createId(), start: "6:30 PM", title: "Dinner with Sam", detail: "Cornelia St" },
        ],
      },
    },
    { id: createId(), type: "divider", style: "solid" },
  ]);
}

function packingSlip(): ReceiptDocumentV2 {
  return doc("Weekend bag", [
    { id: createId(), type: "heading", text: "Weekend bag", level: "display", weight: "bold", italic: false, underline: false, align: "left" },
    { id: createId(), type: "text", text: "Friday · two nights", size: "small", weight: "medium", italic: false, underline: false, align: "left" },
    { id: createId(), type: "divider", style: "dashed" },
    { id: createId(), type: "checklist", items: [
      { id: createId(), text: "Charger", checked: false },
      { id: createId(), text: "Toothbrush", checked: false },
      { id: createId(), text: "Book", checked: true },
    ] },
  ]);
}

function countdownSlip(): ReceiptDocumentV2 {
  return doc("Countdown", [
    {
      id: createId(), type: "catalog", kind: "countdown", definitionVersion: 1,
      data: {
        label: "NEXT UP",
        event: "Coast trip",
        date: "Friday, 4 PM",
        days: 2,
        milestones: [{ label: "Booked", complete: true }, { label: "Packed", complete: false }],
      },
    },
  ]);
}

function habitSlip(): ReceiptDocumentV2 {
  return doc("Habit week", [
    {
      id: createId(), type: "catalog", kind: "habit", definitionVersion: 1,
      data: {
        title: "This week",
        period: "Aug 17 – 23",
        rows: [
          { id: createId(), label: "Walked the dog", values: [2, 2, 2, 2, 0, 2, 2] },
          { id: createId(), label: "Read 20 pages", values: [0, 2, 2, 1, 2, 2, 0] },
        ],
      },
    },
  ]);
}

function meetingSlip(): ReceiptDocumentV2 {
  return doc("Meeting notes", [
    {
      id: createId(), type: "catalog", kind: "meetingNotes", definitionVersion: 1,
      data: {
        dateLabel: "Tue, Aug 18",
        topic: "Studio review",
        decisions: [{ id: createId(), text: "Ship the small one" }],
        actions: [{ id: createId(), text: "Book the airport train", owner: "Pete", done: false }],
      },
    },
  ]);
}

// --- Carousel slips -------------------------------------------------------
// These are the slips shown over the photographs. They are deliberately separate from
// the sample thumbnails above: each one is written for the scene it sits in.

function morningSlip(): ReceiptDocumentV2 {
  return doc("Morning brief", [
    { id: createId(), type: "heading", text: "THURSDAY, 21 AUGUST", level: "display", weight: "bold", italic: false, underline: false, align: "left" },
    {
      id: createId(), type: "catalog", kind: "weather", definitionVersion: 1,
      config: { location: { name: "New York", latitude: 40.78, longitude: -73.97, timezone: "America/New_York" }, unit: "fahrenheit" },
      data: {
        condition: "Clear all day",
        summary: "Warm by noon. Worth eating outside.",
        points: [
          { label: "Morning", temperature: 72, condition: "Clear" },
          { label: "Afternoon", temperature: 84, condition: "Sunny" },
          { label: "Evening", temperature: 76, condition: "Clear" },
        ],
        precipitation: 5,
        uv: 8,
        sunset: "7:52 PM",
        updated: "7:10 AM",
        temperatureTrend: [70, 72, 76, 80, 83, 84, 81, 76],
        precipitationTrend: [0, 0, 5, 5, 5, 0, 0, 0],
        place: "Central Park",
      },
      refreshedAt: "2026-08-21T11:10:00.000Z",
      stale: false,
    },
    { id: createId(), type: "divider", style: "dashed" },
    {
      id: createId(), type: "catalog", kind: "agenda", definitionVersion: 1,
      data: {
        date: "Today",
        events: [
          { id: createId(), start: "7:10 AM", title: "Loop the reservoir", detail: "Before it gets hot" },
          { id: createId(), start: "1:00 PM", title: "Sheep Meadow with Sam" },
          { id: createId(), start: "7:30 PM", title: "Dinner, Cornelia St", detail: "Reservation for two" },
        ],
      },
    },
  ]);
}

function trainingSlip(): ReceiptDocumentV2 {
  return doc("Training week", [
    {
      id: createId(), type: "catalog", kind: "habit", definitionVersion: 1,
      data: {
        title: "Training week",
        period: "Aug 17 – 23",
        rows: [
          // 2 fills the circle, 1 leaves it open, 0 marks a rest day.
          { id: createId(), label: "Ran", values: [2, 0, 2, 2, 1, 0, 2] },
          { id: createId(), label: "Stretched", values: [2, 2, 1, 2, 2, 2, 2] },
          { id: createId(), label: "In bed by ten", values: [2, 2, 2, 1, 2, 0, 2] },
        ],
      },
    },
    { id: createId(), type: "divider", style: "dashed" },
    { id: createId(), type: "text", text: "Friday stays easy. Long one Sunday.", size: "small", weight: "medium", italic: false, underline: false, align: "left" },
  ]);
}

function kitchenSlip(): ReceiptDocumentV2 {
  return doc("This week's dinners", [
    {
      id: createId(), type: "catalog", kind: "mealPlan", definitionVersion: 1,
      data: {
        dateLabel: "Thu – Sat",
        meals: [
          { id: createId(), name: "Thursday", dishes: [{ id: createId(), text: "Lemon tart", detail: "Blind bake the shell first" }] },
          { id: createId(), name: "Friday", dishes: [{ id: createId(), text: "Roast chicken", detail: "In the oven at six" }] },
          { id: createId(), name: "Saturday", dishes: [{ id: createId(), text: "Whatever is left, on toast" }] },
        ],
        // The prep row splits the paper into equal columns and does not wrap, so these stay short.
        prep: [
          { id: createId(), text: "Eggs out", checked: true },
          { id: createId(), text: "Zest lemons", checked: true },
          { id: createId(), text: "Soften butter", checked: false },
        ],
      },
    },
  ]);
}

function tripSlip(): ReceiptDocumentV2 {
  return doc("Coast trip", [
    {
      id: createId(), type: "catalog", kind: "countdown", definitionVersion: 1,
      data: {
        label: "NEXT UP",
        event: "Coast trip",
        date: "Friday, 4 PM",
        days: 2,
        milestones: [{ label: "Booked", complete: true }, { label: "Packed", complete: true }, { label: "Ice", complete: true }],
      },
    },
    { id: createId(), type: "divider", style: "dashed" },
    { id: createId(), type: "text", text: "Key is under the step. Back Sunday.", size: "small", weight: "medium", italic: false, underline: false, align: "left" },
  ]);
}

function campSlip(): ReceiptDocumentV2 {
  return doc("Packed", [
    {
      id: createId(), type: "catalog", kind: "checklistGroups", definitionVersion: 1,
      data: {
        title: "Packed",
        note: "Two nights",
        groups: [
          { name: "Sleep", items: [{ text: "Bag and mat", checked: true }, { text: "Wool socks", checked: true }] },
          { name: "Fire", items: [{ text: "Matches, dry", checked: true }, { text: "Hatchet", checked: true }] },
          { name: "Food", items: [{ text: "Coffee and the pot", checked: true }, { text: "Marshmallows", checked: true }] },
        ],
      },
    },
    { id: createId(), type: "divider", style: "solid" },
    { id: createId(), type: "text", text: "No laptop. On purpose.", size: "small", weight: "medium", italic: false, underline: false, align: "left" },
  ]);
}

export type Moment = {
  id: "morning" | "run" | "cook" | "travel" | "trail";
  /** Not shown; it names the slide for the carousel's tab controls. */
  caption: string;
  ink: string;
  /** Ink height in printer dots. The paper outline is drawn in the same units. */
  inkHeight: number;
  /** Where the slip sits over the photograph, chosen per frame so it lands on a quiet area. */
  placement: { side: "left" | "right"; align: "start" | "center" | "end" };
};

function renderOverlayInk(document: ReceiptDocumentV2) {
  const { svg, height } = renderReceiptSvg(document);
  return { ink: svg.replace(/<rect width="\d+" height="\d+" fill="#fff"\/>/, ""), inkHeight: height };
}

export function createMoments(): Moment[] {
  // Ordered by the light in the photographs: midday, late afternoon, indoors, dusk, dark.
  return [
    { id: "morning", caption: "The morning brief", placement: { side: "left", align: "center" }, ...renderOverlayInk(morningSlip()) },
    { id: "run", caption: "The training week", placement: { side: "right", align: "center" }, ...renderOverlayInk(trainingSlip()) },
    { id: "cook", caption: "This week's dinners", placement: { side: "right", align: "start" }, ...renderOverlayInk(kitchenSlip()) },
    { id: "travel", caption: "Counting down to the trip", placement: { side: "left", align: "end" }, ...renderOverlayInk(tripSlip()) },
    { id: "trail", caption: "Packed for the woods", placement: { side: "right", align: "start" }, ...renderOverlayInk(campSlip()) },
  ];
}

export type LandingDemo = {
  hero: RenderedReceipt;
  samples: Array<{ name: string; rendered: RenderedReceipt }>;
};

export function createLandingDemo(): LandingDemo {
  nextDemoId = 1;
  return {
    hero: renderReceiptSvg(heroSlip()),
    samples: [
      { name: "Checklists", rendered: renderReceiptSvg(packingSlip()) },
      { name: "Countdowns", rendered: renderReceiptSvg(countdownSlip()) },
      { name: "Habit weeks", rendered: renderReceiptSvg(habitSlip()) },
      { name: "Meeting notes", rendered: renderReceiptSvg(meetingSlip()) },
    ],
  };
}

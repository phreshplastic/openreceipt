import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createLogoBlock, createDefaultDocument } from "../receipt";
import { defaultSettings } from "../state/storage";
import { Inspector } from "./Inspector";

const noop = () => undefined;
const receiptDocument = createDefaultDocument();
const base = {
  canRemove: true,
  mode: "format" as const,
  favoriteIds: [] as [],
  recommendedIds: [] as [],
  page: receiptDocument.page,
  settings: defaultSettings,
  documentTitle: "Today",
  onModeChange: noop,
  onChange: noop,
  onTitleChange: noop,
  onRemove: noop,
  onBrowseLibrary: noop,
  onInsertFavorite: noop,
  onRefreshCatalog: async () => undefined,
  onReconfigureCatalog: async () => undefined,
  onPageChange: noop,
  onSettingsChange: noop,
  onPersonalize: noop,
  onDismissWelcome: noop,
  showWelcome: false,
};

describe("Inspector format empty state", () => {
  afterEach(cleanup);

  it("names the receipt and asks you to pick a block, without the sign gallery", () => {
    render(<Inspector {...base} />);

    expect(screen.getByRole("heading", { name: /^Receipt$/ })).toBeInTheDocument();
    expect(screen.getByText("Name your receipt")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Receipt title" })).toHaveValue("Today");
    expect(screen.getByText("Click a block on the receipt to edit it.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Drafts" })).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Printer wordmark" })).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Sign size" })).toBeNull();
  });

  it("shows size and mark controls when the logo block is selected", () => {
    render(<Inspector {...base} block={createLogoBlock()} />);

    expect(screen.getByRole("heading", { name: "Logo" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Sign size" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Printer wordmark" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Logo name" })).toBeInTheDocument();
    expect(screen.queryByText("Name your receipt")).toBeNull();
    expect(screen.queryByText("Click a block on the receipt to edit it.")).toBeNull();
  });
});

describe("Inspector library shelf", () => {
  afterEach(cleanup);

  it("identifies recommended blocks with glyphs instead of paper thumbnails", () => {
    const { container } = render(<Inspector {...base} mode="library" recommendedIds={["countdown", "weather"]} />);

    expect(screen.getByText("For you")).toBeInTheDocument();
    expect(screen.getByText("Countdown")).toBeInTheDocument();
    expect(screen.getByText("Daily weather")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Countdown" })).toBeInTheDocument();
    expect(screen.getByText("Favorites")).toBeInTheDocument();
    expect(screen.getByText("None yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Browse library" })).toBeInTheDocument();
    expect(screen.queryByText("Your favorite blocks live here.")).toBeNull();
    expect(container.querySelectorAll(".library-glyph")).toHaveLength(2);
    expect(container.querySelector(".inspector-favorite-paper")).toBeNull();
    expect(container.querySelector(".library-paper")).toBeNull();
  });
});

describe("Inspector settings", () => {
  afterEach(cleanup);

  it("keeps paper, agent permissions, and naming the printer", () => {
    render(<Inspector {...base} mode="settings" />);

    expect(screen.getByRole("radiogroup", { name: "Paper size" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "80 mm" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Agent permissions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Always ask/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Name your printer" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Home city")).toBeNull();
    expect(screen.queryByText(/Where new weather/)).toBeNull();
    expect(screen.queryByText(/The mark lives on the paper/)).toBeNull();
    expect(screen.queryByText("Current document")).toBeNull();
    expect(screen.queryByText(/WebMCP host/)).toBeNull();
    expect(screen.queryByText(/revision/)).toBeNull();
  });

  it("shows the printer's name once it has been named", () => {
    render(<Inspector {...base} mode="settings" settings={{ ...defaultSettings, printerProfile: { ...defaultSettings.printerProfile, completed: true, ownerFirstName: "Pete" } }} />);

    expect(screen.getByText("Pete’s Printer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Name your printer" })).toBeNull();
  });
});

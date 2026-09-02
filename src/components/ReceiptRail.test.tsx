import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrintJob } from "../bridge/client";
import { ReceiptRail } from "./ReceiptRail";

const noop = () => undefined;
const base = {
  printJobs: [] as PrintJob[],
  drafts: [],
  activeDraftId: "",
  onOpenDraft: noop,
  onDeleteDraft: noop,
  onNewBlank: noop,
  onBrowseTemplates: noop,
  webMcpAvailable: false,
};

describe("ReceiptRail", () => {
  // This project's vitest setup does not auto-clean, so renders would otherwise stack up.
  afterEach(cleanup);

  it("lists drafts, a new-from-template action, and a short print queue", () => {
    const printJobs = [
      { id: "job-1", status: "succeeded", document: { title: "Lisbon" }, updatedAt: "2026-09-02T12:11:00.000Z" },
      { id: "job-2", status: "succeeded", document: { title: "Morning" }, updatedAt: "2026-09-02T12:20:00.000Z" },
      { id: "job-3", status: "failed", document: { title: "Hidden extra" }, updatedAt: "2026-09-02T12:30:00.000Z" },
    ] as unknown as PrintJob[];
    render(<ReceiptRail {...base} printJobs={printJobs} drafts={[{ id: "d1", title: "Groceries", updatedAt: new Date().toISOString() }]} activeDraftId="d1" />);

    expect(screen.getByRole("button", { name: "New blank" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New from template" })).toBeInTheDocument();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("Lisbon")).toBeInTheDocument();
    expect(screen.queryByText("Hidden extra")).toBeNull();
    expect(screen.getByRole("region", { name: "Print queue" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save this receipt/ })).toBeNull();
    expect(screen.queryByText("Blank receipt")).toBeNull();
    expect(screen.queryByText(/On the paper now/)).toBeNull();
    // Infrastructure words stay out of the rail.
    expect(screen.queryByText(/SQLite|bridge|localStorage/i)).toBeNull();
    expect(screen.getByRole("button", { name: /WebMCP tools/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Personalize printer/ })).toBeNull();
  });

  it("opens and deletes a draft through its own controls, and highlights the active one", () => {
    const onOpenDraft = vi.fn();
    const onDeleteDraft = vi.fn();
    render(<ReceiptRail {...base} drafts={[
      { id: "d1", title: "Groceries", updatedAt: new Date().toISOString() },
      { id: "d2", title: "Lisbon", updatedAt: new Date(Date.now() - 60_000).toISOString() },
    ]} activeDraftId="d1" onOpenDraft={onOpenDraft} onDeleteDraft={onDeleteDraft} />);

    expect(screen.getByRole("button", { name: "Groceries" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Lisbon" }).getAttribute("aria-current")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Lisbon" }));
    expect(onOpenDraft).toHaveBeenCalledWith("d2");

    fireEvent.click(screen.getByRole("button", { name: "Delete draft Groceries" }));
    expect(onDeleteDraft).toHaveBeenCalledWith("d1");
  });

  it("lists drafts newest first", () => {
    render(<ReceiptRail {...base} drafts={[
      { id: "older", title: "Older", updatedAt: "2026-09-01T12:00:00.000Z" },
      { id: "newer", title: "Newer", updatedAt: "2026-09-02T12:00:00.000Z" },
    ]} />);

    const names = screen.getAllByRole("button", { name: /^(Older|Newer)$/ }).map((button) => button.getAttribute("aria-label"));
    expect(names[0]).toMatch(/Newer/);
    expect(names[1]).toMatch(/Older/);
  });

  it("opens a blank receipt from the top action", () => {
    const onNewBlank = vi.fn();
    render(<ReceiptRail {...base} onNewBlank={onNewBlank} />);
    fireEvent.click(screen.getByRole("button", { name: "New blank" }));
    expect(onNewBlank).toHaveBeenCalled();
  });

  it("opens the templates modal from the top action", () => {
    const onBrowseTemplates = vi.fn();
    render(<ReceiptRail {...base} onBrowseTemplates={onBrowseTemplates} />);
    fireEvent.click(screen.getByRole("button", { name: "New from template" }));
    expect(onBrowseTemplates).toHaveBeenCalled();
  });

  it("says so when the shelf could not be written", () => {
    render(<ReceiptRail {...base} saveNotice="This browser would not save the shelf." />);
    expect(within(screen.getByRole("status")).getByText(/would not save/)).toBeInTheDocument();
  });
});

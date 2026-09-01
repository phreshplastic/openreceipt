import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type CanonicalReceipt } from "../bridge/client";
import { createDefaultDocument, createReceiptState, type ReceiptState } from "../receipt";
import { ReceiptSession, type ReceiptConflict, type ReceiptSyncStatus } from "./receiptSession";

function canonical(state: ReceiptState): CanonicalReceipt {
  return { ...state, checksum: "checksum", createdAt: "now", updatedAt: "now" };
}

function eventSource() {
  return { addEventListener: vi.fn(), close: vi.fn(), onerror: null } as unknown as EventSource;
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("ReceiptSession", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    });
    vi.useFakeTimers();
  });

  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("initializes an empty API from the browser cache", async () => {
    const initial = createReceiptState(createDefaultDocument());
    const commit = vi.fn(async (state: ReceiptState, expected: number | null) => { void expected; return canonical(state); });
    const statuses: ReceiptSyncStatus[] = [];
    const session = new ReceiptSession(initial, {
      onShared: vi.fn(), onConflict: vi.fn(), onStatus: (status) => statuses.push(status),
    }, {
      ensureSession: vi.fn(async () => "csrf"),
      readReceipt: vi.fn(async () => { throw new ApiError(404, "receipt_not_initialized", "missing"); }),
      commitReceipt: commit,
      createEvents: eventSource,
    });

    await session.start();
    expect(commit).toHaveBeenCalledWith(initial, null, expect.objectContaining({ kind: "human" }), undefined, expect.any(String));
    expect(statuses.at(-1)).toBe("saved");
    session.dispose();
  });

  it("coalesces optimistic edits into the latest complete snapshot", async () => {
    const initial = createReceiptState(createDefaultDocument());
    const commit = vi.fn(async (state: ReceiptState, expected: number | null) => { void expected; return canonical(state); });
    const session = new ReceiptSession(initial, { onShared: vi.fn(), onConflict: vi.fn(), onStatus: vi.fn() }, {
      ensureSession: vi.fn(async () => "csrf"), readReceipt: vi.fn(async () => canonical(initial)), commitReceipt: commit, createEvents: eventSource,
    });
    await session.start();
    const one = createReceiptState({ ...initial.document, title: "One" }, 1);
    const two = createReceiptState({ ...initial.document, title: "Two" }, 2);
    session.publish(one);
    session.publish(two);
    await vi.advanceTimersByTimeAsync(300);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][0].document.title).toBe("Two");
    expect(commit.mock.calls[0][1]).toBe(0);
    session.dispose();
  });

  it("keeps offline edits and presents both versions after a conflicting reconnect", async () => {
    const initial = createReceiptState(createDefaultDocument());
    localStorage.setItem("petes-printer:receipt-sync:v1", JSON.stringify({ serverRevision: 0, dirty: false }));
    let available = false;
    const shared = createReceiptState({ ...initial.document, title: "Shared" }, 2);
    let conflict: ReceiptConflict | undefined;
    const accepted: ReceiptState[] = [];
    const session = new ReceiptSession(initial, {
      onShared: (state) => accepted.push(state), onConflict: (next) => { conflict = next; }, onStatus: vi.fn(),
    }, {
      ensureSession: vi.fn(async () => { if (!available) throw new Error("offline"); return "csrf"; }),
      readReceipt: vi.fn(async () => canonical(shared)), commitReceipt: vi.fn(), createEvents: eventSource,
    });
    await session.start();
    const local = createReceiptState({ ...initial.document, title: "Offline draft" }, 1);
    session.publish(local);
    available = true;
    await vi.advanceTimersByTimeAsync(2_100);
    await settle();
    expect(conflict?.local.document.title).toBe("Offline draft");
    expect(conflict?.shared.document.title).toBe("Shared");

    await session.resolveConflict("shared");
    expect(accepted.at(-1)?.document.title).toBe("Shared");
    session.dispose();
  });

  it("rebases keep-my-version one revision above the shared receipt", async () => {
    const initial = createReceiptState(createDefaultDocument());
    localStorage.setItem("petes-printer:receipt-sync:v1", JSON.stringify({ serverRevision: 0, dirty: true }));
    const shared = createReceiptState({ ...initial.document, title: "Shared" }, 4);
    const commit = vi.fn(async (state: ReceiptState, expected: number | null) => { void expected; return canonical(state); });
    const accepted: ReceiptState[] = [];
    const session = new ReceiptSession(initial, {
      onShared: (state) => accepted.push(state), onConflict: vi.fn(), onStatus: vi.fn(),
    }, {
      ensureSession: vi.fn(async () => "csrf"), readReceipt: vi.fn(async () => canonical(shared)), commitReceipt: commit, createEvents: eventSource,
    });
    await session.start();
    await session.resolveConflict("local");
    expect(commit.mock.calls[0][0].revision).toBe(5);
    expect(commit.mock.calls[0][1]).toBe(4);
    expect(accepted.at(-1)?.revision).toBe(5);
    session.dispose();
  });

  it("applies a clean external event and forwards its agent metadata", async () => {
    const initial = createReceiptState(createDefaultDocument());
    let remote = canonical(initial);
    const listeners = new Map<string, EventListener>();
    const source = {
      addEventListener: (name: string, listener: EventListenerOrEventListenerObject) => listeners.set(name, listener as EventListener),
      close: vi.fn(), onerror: null,
    } as unknown as EventSource;
    const accepted: ReceiptState[] = [];
    const events: unknown[] = [];
    const session = new ReceiptSession(initial, {
      onShared: (state) => accepted.push(state), onConflict: vi.fn(), onStatus: vi.fn(), onEvent: (event) => events.push(event),
    }, {
      ensureSession: vi.fn(async () => "csrf"), readReceipt: vi.fn(async () => remote),
      commitReceipt: vi.fn(), createEvents: () => source,
    });
    await session.start();
    remote = canonical(createReceiptState({ ...initial.document, title: "Changed through HTTP" }, 1));
    listeners.get("receipt.updated")?.(new MessageEvent("receipt.updated", { data: JSON.stringify({
      mutationId: crypto.randomUUID(), actor: { kind: "mcp", label: "Codex" }, summary: "Agent changed the title", changedBlockIds: [], revision: 1,
    }), lastEventId: "8" }));
    await settle();
    expect(accepted.at(-1)?.document.title).toBe("Changed through HTTP");
    expect(events.at(-1)).toMatchObject({ actor: { kind: "mcp", label: "Codex" } });
    session.dispose();
  });
});

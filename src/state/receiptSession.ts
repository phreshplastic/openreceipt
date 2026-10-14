import { ApiError, bridgeEventsUrl, commitCanonicalReceipt, ensureBrowserSession, getCanonicalReceipt, openSharedReceipt, type ApiActor, type CanonicalReceipt } from "../bridge/client";
import { createReceiptState, type ReceiptState } from "../receipt";

const SYNC_KEY = "petes-printer:receipt-sync:v1";
const COMMIT_DELAY = 280;
const HUMAN_PRIORITY_MS = 8_000;
// A browser with no bridge running must not retry forever at a fixed interval: on the
// public site every attempt is a blocked cross-origin call to localhost, and a tab left
// open all afternoon would log thousands of them. Back off instead, and reset on success.
const RETRY_MIN_MS = 2_000;
const RETRY_MAX_MS = 60_000;

type SyncMetadata = { serverRevision: number | null; serverReceiptId?: string; dirty: boolean };
export type ReceiptSyncStatus = "connecting" | "saved" | "saving" | "offline" | "conflict";
export type ReceiptConflict = { local: ReceiptState; shared: ReceiptState };
export type ReceiptEvent = { mutationId?: string; actor?: ApiActor; summary?: string; changedBlockIds?: string[]; revision?: number };

type Dependencies = {
  ensureSession: typeof ensureBrowserSession;
  readReceipt: typeof getCanonicalReceipt;
  commitReceipt: typeof commitCanonicalReceipt;
  createEvents(after: number): EventSource;
};

const defaultDependencies: Dependencies = {
  ensureSession: ensureBrowserSession,
  readReceipt: getCanonicalReceipt,
  commitReceipt: commitCanonicalReceipt,
  // Absolute bridge URL, not a relative path: the public site and the direct-bridge local
  // app both serve the app from an origin that is not the bridge, so a relative stream URL
  // resolves to the web host and never reaches the daemon.
  createEvents: (after) => new EventSource(bridgeEventsUrl(after), { withCredentials: true }),
};

export class ReceiptSession {
  private latest: ReceiptState;
  private serverRevision: number | null = null;
  private serverReceiptId?: string;
  private dirty = false;
  private online = false;
  private stopped = false;
  private committing = false;
  private timer?: number;
  private retryTimer?: number;
  private events?: EventSource;
  private conflict?: ReceiptConflict;
  private pendingActor: ApiActor = { kind: "human", label: "Browser" };
  private pendingSummary?: string;
  private mutationIds = new Set<string>();
  private lastEventId = 0;
  private lastHumanPublishAt = 0;
  private preferringLocal = false;
  private offlineAttempts = 0;

  constructor(
    initial: ReceiptState,
    private callbacks: {
      onShared(state: ReceiptState, event?: ReceiptEvent): void;
      onConflict(conflict?: ReceiptConflict): void;
      onStatus(status: ReceiptSyncStatus): void;
      onEvent?(event: ReceiptEvent): void;
    },
    private dependencies: Dependencies = defaultDependencies,
  ) {
    this.latest = createReceiptState(initial.document, initial.revision, initial.source);
    const metadata = this.readMetadata();
    this.serverRevision = metadata.serverRevision;
    this.serverReceiptId = metadata.serverReceiptId;
    this.dirty = metadata.dirty;
  }

  get isOnline() { return this.online; }

  async openSaved(id: string) {
    if (this.conflict) throw new Error("Resolve the current receipt conflict before switching receipts.");
    await this.flush();
    if (this.dirty || this.committing) throw new Error("Wait for the current receipt to finish saving before switching.");
    const saved = await openSharedReceipt(id);
    this.acceptShared(saved);
  }

  async start() {
    this.callbacks.onStatus("connecting");
    try {
      await this.dependencies.ensureSession();
      if (this.stopped) return;
      let shared: CanonicalReceipt | undefined;
      try {
        shared = await this.dependencies.readReceipt();
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== "receipt_not_initialized") throw error;
      }
      if (this.stopped) return;
      this.goOnline();
      if (!shared) {
        this.serverRevision = null;
        this.dirty = true;
        await this.flush();
      } else if (this.dirty && this.serverRevision !== null) {
        if (shared.revision === this.serverRevision && shared.document.id === (this.serverReceiptId ?? this.latest.document.id)) {
          this.serverReceiptId = shared.document.id;
          await this.flush();
        }
        else this.raiseConflict(shared, "startup");
      } else {
        this.acceptShared(shared);
      }
      this.openEvents();
    } catch {
      this.goOffline();
    }
  }

  publish(state: ReceiptState, actor: ApiActor = { kind: "human", label: "Browser" }, summary?: string) {
    this.latest = createReceiptState(state.document, state.revision, state.source);
    this.pendingActor = actor;
    this.pendingSummary = summary;
    if (actor.kind === "human") this.lastHumanPublishAt = Date.now();
    this.dirty = true;
    this.writeMetadata();
    if (this.conflict) {
      this.conflict.local = this.latest;
      this.callbacks.onConflict(this.conflict);
      return;
    }
    this.callbacks.onStatus(this.online ? "saving" : "offline");
    this.scheduleFlush();
  }

  async resolveConflict(choice: "shared" | "local") {
    if (!this.conflict) return;
    const conflict = this.conflict;
    this.conflict = undefined;
    this.callbacks.onConflict(undefined);
    if (choice === "shared") {
      this.acceptShared(conflict.shared);
      return;
    }
    this.serverRevision = conflict.shared.revision;
    this.serverReceiptId = conflict.shared.document.id;
    const local = conflict.local.document;
    // Recover a different receipt as a new copy rather than overwriting its saved
    // version without having read that receipt's current revision.
    const document = local.id === conflict.shared.document.id ? local : { ...local, id: crypto.randomUUID(), title: `${local.title.slice(0, 147)} (recovered)` };
    this.latest = createReceiptState(document, conflict.shared.revision + 1, conflict.local.source);
    this.dirty = true;
    this.callbacks.onShared(this.latest);
    this.writeMetadata();
    await this.flush();
  }

  dispose() {
    this.stopped = true;
    if (this.timer) window.clearTimeout(this.timer);
    if (this.retryTimer) window.clearTimeout(this.retryTimer);
    this.events?.close();
  }

  private scheduleFlush(delay = COMMIT_DELAY) {
    if (this.stopped || this.conflict) return;
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.flush(), delay);
  }

  private async flush() {
    if (this.stopped || this.committing || this.conflict || !this.dirty) return;
    this.committing = true;
    const submitted = this.latest;
    const mutationId = crypto.randomUUID();
    this.mutationIds.add(mutationId);
    this.callbacks.onStatus("saving");
    try {
      const committed = await this.dependencies.commitReceipt(submitted, this.serverRevision, this.pendingActor, this.pendingSummary, mutationId, undefined, this.serverReceiptId);
      if (this.stopped) return;
      this.goOnline();
      this.serverRevision = committed.revision;
      this.serverReceiptId = committed.document.id;
      this.dirty = this.latest.revision !== submitted.revision || JSON.stringify(this.latest.document) !== JSON.stringify(submitted.document);
      this.writeMetadata();
      this.callbacks.onStatus(this.dirty ? "saving" : "saved");
    } catch (error) {
      if (error instanceof ApiError && error.code === "stale_revision" && error.current) this.raiseConflict(error.current as CanonicalReceipt, "stale");
      else this.goOffline();
    } finally {
      this.committing = false;
      if (this.dirty && this.online && !this.conflict) this.scheduleFlush(0);
    }
  }

  private acceptShared(shared: Pick<CanonicalReceipt, "document" | "revision" | "source">, event?: ReceiptEvent) {
    this.latest = createReceiptState(shared.document, shared.revision, shared.source);
    this.serverRevision = shared.revision;
    this.serverReceiptId = shared.document.id;
    this.dirty = false;
    this.conflict = undefined;
    this.writeMetadata();
    this.callbacks.onShared(this.latest, event);
    this.callbacks.onConflict(undefined);
    this.callbacks.onStatus("saved");
  }

  private shouldPreferLocal() {
    return this.pendingActor.kind === "human" && Date.now() - this.lastHumanPublishAt < HUMAN_PRIORITY_MS;
  }

  private raiseConflict(shared: Pick<CanonicalReceipt, "document" | "revision" | "source">, source: "live" | "stale" | "reconnect" | "startup") {
    if (shared.document.id === this.latest.document.id && (source === "live" || source === "stale") && this.shouldPreferLocal() && !this.preferringLocal) {
      void this.keepLocal(shared);
      return;
    }
    this.surfaceConflict(shared);
  }

  private surfaceConflict(shared: Pick<CanonicalReceipt, "document" | "revision" | "source">) {
    this.conflict = { local: this.latest, shared: createReceiptState(shared.document, shared.revision, shared.source) };
    this.callbacks.onConflict(this.conflict);
    this.callbacks.onStatus("conflict");
  }

  private async keepLocal(shared: Pick<CanonicalReceipt, "document" | "revision" | "source">) {
    this.preferringLocal = true;
    this.serverRevision = shared.revision;
    this.latest = createReceiptState(this.latest.document, shared.revision + 1, this.latest.source);
    this.dirty = true;
    this.callbacks.onShared(this.latest);
    this.writeMetadata();
    if (this.committing) {
      this.preferringLocal = false;
      return;
    }
    try {
      await this.flush();
    } finally {
      this.preferringLocal = false;
    }
  }

  private goOnline() {
    this.online = true;
    this.offlineAttempts = 0;
  }

  private goOffline() {
    this.online = false;
    this.callbacks.onStatus("offline");
    if (this.stopped) return;
    const delay = Math.min(RETRY_MAX_MS, RETRY_MIN_MS * 2 ** this.offlineAttempts);
    this.offlineAttempts += 1;
    this.retryTimer = window.setTimeout(() => void this.reconnect(), delay);
  }

  private async reconnect() {
    if (this.stopped) return;
    try {
      await this.dependencies.ensureSession();
      if (this.stopped) return;
      const shared = await this.dependencies.readReceipt();
      if (this.stopped) return;
      this.goOnline();
      if (this.dirty && shared.revision === this.serverRevision && shared.document.id === (this.serverReceiptId ?? this.latest.document.id)) {
        this.serverReceiptId = shared.document.id;
        await this.flush();
      }
      else if (this.dirty) this.raiseConflict(shared, "reconnect");
      else this.acceptShared(shared);
      this.openEvents();
    } catch {
      this.goOffline();
    }
  }

  private openEvents() {
    this.events?.close();
    this.events = this.dependencies.createEvents(this.lastEventId);
    this.events.addEventListener("receipt.updated", (raw) => void this.receiveReceiptEvent(raw as MessageEvent));
    this.events.addEventListener("print_request.updated", (raw) => this.callbacks.onEvent?.(JSON.parse((raw as MessageEvent).data) as ReceiptEvent));
    this.events.addEventListener("queue.updated", () => this.callbacks.onEvent?.({}));
    this.events.addEventListener("shelf.updated", () => this.callbacks.onEvent?.({}));
    this.events.onerror = () => { /* EventSource reconnects with Last-Event-ID and the durable event log replays gaps. */ };
  }

  private async receiveReceiptEvent(raw: MessageEvent) {
    this.lastEventId = Number(raw.lastEventId) || this.lastEventId;
    const event = JSON.parse(raw.data) as ReceiptEvent;
    if (event.mutationId && this.mutationIds.delete(event.mutationId)) return;
    try {
      const shared = await this.dependencies.readReceipt();
      if (this.stopped) return;
      if (this.dirty) this.raiseConflict(shared, "live");
      else {
        this.acceptShared(shared, event);
        this.callbacks.onEvent?.(event);
      }
    } catch {
      this.goOffline();
    }
  }

  private readMetadata(): SyncMetadata {
    try {
      const value = JSON.parse(localStorage.getItem(SYNC_KEY) ?? "null") as SyncMetadata | null;
      return value && (typeof value.serverRevision === "number" || value.serverRevision === null)
        ? { serverRevision: value.serverRevision, serverReceiptId: value.serverReceiptId, dirty: Boolean(value.dirty) }
        : { serverRevision: null, dirty: false };
    } catch {
      return { serverRevision: null, dirty: false };
    }
  }

  private writeMetadata() {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ serverRevision: this.serverRevision, serverReceiptId: this.serverReceiptId, dirty: this.dirty } satisfies SyncMetadata));
  }
}

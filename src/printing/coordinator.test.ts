import { describe, expect, it, vi } from "vitest";
import { createDefaultDocument } from "../receipt";
import { PrintCoordinator, type PrintApprovalDecision, type PrintSnapshot } from "./coordinator";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("PrintCoordinator", () => {
  it("prints the approved immutable snapshot", async () => {
    const document = createDefaultDocument();
    const approval = deferred<PrintApprovalDecision>();
    const execute = vi.fn(async (snapshot: PrintSnapshot) => {
      void snapshot;
      return { status: "succeeded" as const, jobId: "job-1", checksum: "sum", message: "Printed" };
    });
    const coordinator = new PrintCoordinator({ getCurrentRevision: () => 4, requestApproval: () => approval.promise, execute });
    const resultPromise = coordinator.request({ snapshot: { revision: 4, document }, requiresApproval: true });
    document.title = "Changed outside the coordinator";
    approval.resolve("approve");
    const result = await resultPromise;
    expect(result.status).toBe("succeeded");
    expect(execute.mock.calls[0]?.[0].document.title).not.toBe(document.title);
  });

  it("invalidates approval when the visible receipt changes", async () => {
    let revision = 4;
    const approval = deferred<PrintApprovalDecision>();
    const execute = vi.fn();
    const coordinator = new PrintCoordinator({ getCurrentRevision: () => revision, requestApproval: () => approval.promise, execute });
    const resultPromise = coordinator.request({ snapshot: { revision, document: createDefaultDocument() }, requiresApproval: true });
    revision = 5;
    approval.resolve("approve");
    expect(await resultPromise).toMatchObject({ status: "stale", revision: 4 });
    expect(execute).not.toHaveBeenCalled();
  });

  it("coalesces the same snapshot and refuses a different concurrent print", async () => {
    const execution = deferred<{ status: "succeeded"; message: string }>();
    const document = createDefaultDocument();
    const coordinator = new PrintCoordinator({ getCurrentRevision: () => 2, requestApproval: async () => "approve", execute: () => execution.promise });
    const first = coordinator.request({ snapshot: { revision: 2, document }, requiresApproval: false });
    const same = coordinator.request({ snapshot: { revision: 2, document }, requiresApproval: false });
    const other = await coordinator.request({ snapshot: { revision: 3, document: { ...document, id: crypto.randomUUID() } }, requiresApproval: false });
    expect(same).toBe(first);
    expect(other.status).toBe("busy");
    execution.resolve({ status: "succeeded", message: "Printed" });
    await first;
  });

  it("cancels approval through an AbortSignal", async () => {
    const controller = new AbortController();
    const coordinator = new PrintCoordinator({
      getCurrentRevision: () => 1,
      requestApproval: (_snapshot, _reason, signal) => new Promise((resolve) => signal.addEventListener("abort", () => resolve("reject"), { once: true })),
      execute: vi.fn(),
    });
    const resultPromise = coordinator.request({ snapshot: { revision: 1, document: createDefaultDocument() }, requiresApproval: true, signal: controller.signal });
    controller.abort();
    expect((await resultPromise).status).toBe("cancelled");
  });
});

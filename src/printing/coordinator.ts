import type { ReceiptDocumentV2 } from "../receipt";

export type PrintSnapshot = {
  revision: number;
  document: ReceiptDocumentV2;
};

export type PrintApprovalDecision = "approve" | "reject" | "stale";
export type PrintResultStatus = "succeeded" | "rejected" | "cancelled" | "stale" | "busy" | "failed" | "unknown";

export type PrintResult = {
  status: PrintResultStatus;
  revision: number;
  checksum?: string;
  jobId?: string;
  message: string;
};

export type PrintExecutionResult = Omit<PrintResult, "revision">;

export type PrintRequest = {
  snapshot: PrintSnapshot;
  reason?: string;
  requiresApproval: boolean;
  requester?: "human" | "webmcp";
  signal?: AbortSignal;
};

type Dependencies = {
  getCurrentRevision(): number;
  requestApproval(snapshot: PrintSnapshot, reason: string | undefined, signal: AbortSignal): Promise<PrintApprovalDecision>;
  execute(snapshot: PrintSnapshot, signal: AbortSignal, request: Pick<PrintRequest, "reason" | "requester">): Promise<PrintExecutionResult>;
};

function cancelled(snapshot: PrintSnapshot): PrintResult {
  return { status: "cancelled", revision: snapshot.revision, message: "The print request was cancelled before completion." };
}

function isAbortError(error: unknown) {
  return error instanceof DOMException ? error.name === "AbortError" : error instanceof Error && error.name === "AbortError";
}

export class PrintCoordinator {
  private active?: { key: string; promise: Promise<PrintResult>; controller: AbortController };

  constructor(private readonly dependencies: Dependencies) {}

  request(request: PrintRequest): Promise<PrintResult> {
    const snapshot = {
      revision: request.snapshot.revision,
      document: structuredClone(request.snapshot.document),
    };
    const key = `${snapshot.document.id}:${snapshot.revision}`;
    if (this.active) {
      if (this.active.key === key) return this.active.promise;
      return Promise.resolve({
        status: "busy",
        revision: snapshot.revision,
        message: "Another receipt is already waiting for approval or printing.",
      });
    }

    const controller = new AbortController();
    const abort = () => controller.abort(request.signal?.reason);
    if (request.signal?.aborted) abort();
    else request.signal?.addEventListener("abort", abort, { once: true });

    const promise = this.run({ ...request, snapshot }, controller.signal).finally(() => {
      request.signal?.removeEventListener("abort", abort);
      if (this.active?.key === key) this.active = undefined;
    });
    this.active = { key, promise, controller };
    return promise;
  }

  cancel(reason = "Print coordination ended.") {
    this.active?.controller.abort(reason);
  }

  private async run(request: Omit<PrintRequest, "signal"> & { signal?: AbortSignal }, signal: AbortSignal): Promise<PrintResult> {
    const { snapshot } = request;
    try {
      if (signal.aborted) return cancelled(snapshot);
      if (request.requiresApproval) {
        const decision = await this.dependencies.requestApproval(snapshot, request.reason, signal);
        if (signal.aborted) return cancelled(snapshot);
        if (decision === "reject") {
          return { status: "rejected", revision: snapshot.revision, message: "The user kept the receipt as a draft." };
        }
        if (decision === "stale") {
          return { status: "stale", revision: snapshot.revision, message: "The receipt changed while approval was open. Nothing was printed." };
        }
      }
      if (this.dependencies.getCurrentRevision() !== snapshot.revision) {
        return { status: "stale", revision: snapshot.revision, message: "The receipt changed before printing. Nothing was printed." };
      }
      const result = await this.dependencies.execute(snapshot, signal, request);
      return { ...result, revision: snapshot.revision };
    } catch (error) {
      if (signal.aborted || isAbortError(error)) return cancelled(snapshot);
      return {
        status: "failed",
        revision: snapshot.revision,
        message: error instanceof Error ? error.message : "Printing failed.",
      };
    }
  }
}

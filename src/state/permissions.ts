import type { ReceiptState } from "../receipt";
import type { AppSettings } from "./storage";

export type AgentPrintDecision = "allow" | "confirm";

export function decideAgentPrint(settings: AppSettings, state: ReceiptState): AgentPrintDecision {
  if (settings.printPolicy === "autonomous") return "allow";
  if (settings.printPolicy === "approved" && state.source?.kind === "template" && settings.trustedTemplateIds.includes(state.source.id)) return "allow";
  return "confirm";
}

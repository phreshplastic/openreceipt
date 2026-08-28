import { describe, expect, it } from "vitest";
import { createReceiptState, createDefaultDocument } from "../receipt";
import { decideAgentPrint } from "./permissions";
import type { AppSettings } from "./storage";

const settings = (printPolicy: AppSettings["printPolicy"], trustedTemplateIds: string[] = []): AppSettings => ({ configured: true, printPolicy, trustedTemplateIds });

describe("agent print permissions", () => {
  it("confirms by default", () => expect(decideAgentPrint(settings("confirm"), createReceiptState(createDefaultDocument()))).toBe("confirm"));
  it("allows only a matching trusted template", () => {
    const trusted = createReceiptState(createDefaultDocument(), 0, { kind: "template", id: "blank", revision: 1 });
    expect(decideAgentPrint(settings("approved", ["blank"]), trusted)).toBe("allow");
    expect(decideAgentPrint(settings("approved", ["checklist"]), trusted)).toBe("confirm");
  });
  it("allows autonomous requests", () => expect(decideAgentPrint(settings("autonomous"), createReceiptState(createDefaultDocument()))).toBe("allow"));
});

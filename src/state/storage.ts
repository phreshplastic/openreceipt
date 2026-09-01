import { createReceiptState, receiptDocumentSchema, type ReceiptState } from "../receipt";

const RECEIPT_KEY = "petes-printer:receipt:v1";
const SETTINGS_KEY = "petes-printer:settings:v1";

export type PrintPolicyMode = "confirm" | "approved" | "autonomous";

export const printPolicies: { id: PrintPolicyMode; name: string; description: string }[] = [
  { id: "confirm", name: "Confirm each print", description: "Agent requests wait for your approval." },
  { id: "approved", name: "Approved automations", description: "Trusted templates may print on their own." },
  { id: "autonomous", name: "Allow agent printing", description: "Agent requests print immediately." },
];

export type AppSettings = {
  configured: boolean;
  printPolicy: PrintPolicyMode;
  trustedTemplateIds: string[];
};

export const defaultSettings: AppSettings = {
  configured: false,
  printPolicy: "confirm",
  trustedTemplateIds: [],
};

export function loadReceipt(fallback: ReceiptState) {
  try {
    const raw = localStorage.getItem(RECEIPT_KEY);
    if (!raw) return fallback;
    const stored = JSON.parse(raw) as Partial<ReceiptState>;
    return createReceiptState(receiptDocumentSchema.parse(stored.document), Number(stored.revision) || 0, stored.source);
  } catch {
    return fallback;
  }
}

export function saveReceipt(state: ReceiptState) {
  localStorage.setItem(RECEIPT_KEY, JSON.stringify(state));
}

export function loadSettings(): AppSettings {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<AppSettings> | null;
    if (!value) return defaultSettings;
    const printPolicy = ["confirm", "approved", "autonomous"].includes(value.printPolicy ?? "") ? value.printPolicy as PrintPolicyMode : "confirm";
    return { configured: Boolean(value.configured), printPolicy, trustedTemplateIds: Array.isArray(value.trustedTemplateIds) ? value.trustedTemplateIds.filter((item): item is string => typeof item === "string") : [] };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

import { createReceiptState, receiptDocumentSchema, type ReceiptState } from "../receipt";
import { acceptPrinterProfile, defaultPrinterProfile, type PrinterProfile } from "../onboarding/profile";
import { guessHomeDefaults, type UnitPreference } from "./defaults";

const RECEIPT_KEY = "petes-printer:receipt:v1";
const SETTINGS_KEY = "petes-printer:settings:v1";

export type PrintPolicyMode = "confirm" | "approved" | "autonomous";

export const printPolicies: { id: PrintPolicyMode; name: string; description: string }[] = [
  { id: "confirm", name: "Always ask", description: "An agent print waits for you." },
  { id: "approved", name: "Trusted templates", description: "Those templates may print on their own." },
  { id: "autonomous", name: "Allow without asking", description: "Agent prints go straight to the printer." },
];

export type AppSettings = {
  configured: boolean;
  printPolicy: PrintPolicyMode;
  trustedTemplateIds: string[];
  /** Where "here" means, for live blocks and for agents. Empty when unknown. */
  defaultLocation: string;
  defaultUnit: UnitPreference;
  printerProfile: PrinterProfile;
};

/** The fields the bridge owns. One list, so adding the next one is a single edit. */
const sharedKeys = ["configured", "printPolicy", "trustedTemplateIds", "defaultLocation", "defaultUnit", "printerProfile"] as const;
export type SharedSettings = Pick<AppSettings, (typeof sharedKeys)[number]>;

const guessed = guessHomeDefaults();

export const defaultSettings: AppSettings = {
  configured: false,
  printPolicy: "confirm",
  trustedTemplateIds: [],
  defaultLocation: guessed.location,
  defaultUnit: guessed.unit,
  printerProfile: defaultPrinterProfile,
};

/** Narrows anything the bridge returns down to the settings the app keeps. */
export function acceptSharedSettings(shared: Partial<SharedSettings>): SharedSettings {
  return {
    configured: Boolean(shared.configured),
    printPolicy: isPrintPolicy(shared.printPolicy) ? shared.printPolicy : "confirm",
    trustedTemplateIds: Array.isArray(shared.trustedTemplateIds) ? shared.trustedTemplateIds.filter((item): item is string => typeof item === "string") : [],
    defaultLocation: typeof shared.defaultLocation === "string" ? shared.defaultLocation : "",
    defaultUnit: shared.defaultUnit === "celsius" || shared.defaultUnit === "fahrenheit" ? shared.defaultUnit : defaultSettings.defaultUnit,
    printerProfile: acceptPrinterProfile(shared.printerProfile),
  };
}

/** The subset sent to the bridge on every save. */
export function shareableSettings(settings: AppSettings): SharedSettings {
  return Object.fromEntries(sharedKeys.map((key) => [key, settings[key]])) as SharedSettings;
}

function isPrintPolicy(value: unknown): value is PrintPolicyMode {
  return value === "confirm" || value === "approved" || value === "autonomous";
}

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
    const accepted = acceptSharedSettings(value);
    // A blank stored location means we never guessed one; guess again rather than stay blank.
    return { ...accepted, defaultLocation: accepted.defaultLocation || defaultSettings.defaultLocation };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

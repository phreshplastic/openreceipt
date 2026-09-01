export type UnitPreference = "fahrenheit" | "celsius";

/** IANA zones whose city segment is not what a geocoder wants. */
const cityOverrides: Record<string, string> = {
  "Asia/Calcutta": "Kolkata",
  "Asia/Katmandu": "Kathmandu",
  "Asia/Saigon": "Ho Chi Minh City",
  "Europe/Kiev": "Kyiv",
  "America/Indiana/Indianapolis": "Indianapolis",
};

/** The handful of zones that still think in Fahrenheit. */
const fahrenheitZones = /^(America\/(New_York|Chicago|Denver|Phoenix|Los_Angeles|Anchorage|Adak|Detroit|Boise|Juneau|Menominee|Nome|Sitka|Yakutat|Indiana\/|Kentucky\/|North_Dakota\/)|Pacific\/(Honolulu|Guam|Midway|Pago_Pago)|America\/Puerto_Rico)/;

/**
 * Guesses where someone is from their timezone alone — no permission prompt, no
 * request to a third party, no IP leaving the machine. IANA ids are `Region/City`,
 * so the last segment is usually a geocodable place name.
 */
export function guessHomeDefaults(timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): { location: string; unit: UnitPreference } {
  const unit: UnitPreference = fahrenheitZones.test(timeZone ?? "") ? "fahrenheit" : "celsius";
  if (!timeZone || /^(UTC|GMT|Local|Etc\/)/.test(timeZone)) return { location: "", unit };
  const override = cityOverrides[timeZone];
  if (override) return { location: override, unit };
  const city = timeZone.split("/").at(-1)?.replaceAll("_", " ").trim() ?? "";
  return { location: city, unit };
}

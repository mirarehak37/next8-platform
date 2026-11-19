import { tagGroup } from "@/lib/tag-groups";

type Row = Record<string, string>;

export const APP_SOURCE = "Aplikace NEXT8";

// Every other column of the app export is kept on the contact as a custom field
// ("Údaje z aplikace"). header = the export's column name; re-import overwrites.
export const APP_CUSTOM_FIELDS = [
  { key: "app_registered_at", header: "Registrace", fieldType: "date" },
  { key: "app_registered_via", header: "Registrace přes", fieldType: "text" },
  { key: "app_platform", header: "Platforma", fieldType: "text" },
  { key: "app_account_type", header: "Typ účtu", fieldType: "text" },
  { key: "app_plan", header: "Plán", fieldType: "text" },
  { key: "app_payment_via", header: "Platba přes", fieldType: "text" },
  { key: "app_subscription_until", header: "Předplatné do", fieldType: "date" },
  { key: "app_role", header: "Role", fieldType: "text" },
  { key: "app_teams", header: "Tým(y)", fieldType: "text" },
  { key: "app_activity", header: "Aktivita", fieldType: "text" },
  { key: "app_last_activity", header: "Poslední aktivita", fieldType: "date" },
  { key: "app_active_days_7", header: "Aktivní dny (7)", fieldType: "number" },
  { key: "app_active_days_30", header: "Aktivní dny (30)", fieldType: "number" },
  { key: "app_active_days_total", header: "Aktivní dny celkem", fieldType: "number" },
  { key: "app_marketing_consent", header: "Marketing souhlas", fieldType: "text" },
  { key: "app_consent_source", header: "Zdroj souhlasu", fieldType: "text" },
  { key: "app_commercial_ok", header: "Smí obchodní sdělení", fieldType: "text" },
  { key: "app_push", header: "Push", fieldType: "text" },
  { key: "app_morning_reminder", header: "Ranní připomínka", fieldType: "text" },
  { key: "app_evening_reminder", header: "Večerní připomínka", fieldType: "text" },
  { key: "app_gender", header: "Pohlaví", fieldType: "text" },
  { key: "app_age_category", header: "Věková kategorie", fieldType: "text" },
  { key: "app_position", header: "Pozice", fieldType: "text" },
  { key: "app_cohort", header: "Kohorta", fieldType: "text" },
  { key: "app_codes", header: "Použité kódy", fieldType: "text" },
  { key: "app_user_id", header: "ID uživatele", fieldType: "text" },
] as const;

// Import-row keys that feed the contact itself; their values come from these custom-field columns.
export const APP_ROW_KEYS = {
  marketingConsent: "app_commercial_ok",
  ageCategory: "app_age_category",
  teams: "app_teams",
} as const;
const AGE_NO_CONSENT = "do 15 let";

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

function splitTags(v: string | undefined) {
  return (v ?? "")
    .split(/[,;]/)
    .map((t) => t.trim().replace(/\s+/g, " ").slice(0, 60))
    .filter(Boolean);
}

// One row of the NEXT8 app export → a contact row. Same rules every time, so the
// raw export can be re-imported as is and the CRM catches up with the app:
// - missing names fall back to the nickname / e-mail, the CRM needs both names;
// - commercial messages only with the app's consent AND not for under-15s
//   (in CZ their consent has to come from a parent);
// - all app tags are kept, made into groups where they come in pairs so a
//   re-import replaces them; teams become "Tým: …"; consent decides the
//   "Smí obchodní sdělení" / "Jen servisní e-maily" tag.
export function appUserToContactRow(r: Row): Row | null {
  const email = r.email?.trim();
  if (!email) return null;
  const firstName = r.firstName?.trim() || r.nickname?.trim() || email.split("@")[0];
  const lastName = r.lastName?.trim() || "(bez příjmení)";

  const raw = splitTags(r.tags);
  const minor =
    norm(r[APP_ROW_KEYS.ageCategory]) === AGE_NO_CONSENT || raw.some((t) => norm(t) === `věk: ${AGE_NO_CONSENT}`);
  const consent = ["ano", "yes", "true", "1"].includes(norm(r[APP_ROW_KEYS.marketingConsent])) && !minor;

  const tags = [
    APP_SOURCE,
    ...raw
      .filter((t) => tagGroup(t) !== "consent")
      .map((t) => t.replace(/^Push (zapnutý|vypnutý)$/i, (_, v: string) => `Push: ${v.toLowerCase()}`)),
    ...splitTags(r[APP_ROW_KEYS.teams]).map((t) => `Tým: ${t}`),
    consent ? "Smí obchodní sdělení" : "Jen servisní e-maily",
  ];

  return {
    firstName,
    lastName,
    email,
    marketingConsent: consent ? "ano" : "ne",
    source: APP_SOURCE,
    tags: [...new Set(tags)].join(", "),
  };
}


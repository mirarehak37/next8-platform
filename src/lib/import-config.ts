// Field definitions for the CRM bulk-import wizard. Each config drives both the
// column-mapping UI and the row validation before the server action runs.

export type ImportEntity = "company" | "contact" | "lead" | "product";

export type ImportField = {
  key: string;
  label: string;
  required?: boolean;
  example?: string;
  /** Column names that map to this field automatically (lower-case). */
  aliases?: string[];
};

// Alternatives where any one group of fields is enough (e.g. a contact needs either
// "Celé jméno" or both "Jméno" and "Příjmení"). Entities not listed use `required`.
export const IMPORT_REQUIRED_GROUPS: Partial<Record<ImportEntity, { groups: string[][]; label: string }>> = {
  contact: {
    groups: [["fullName"], ["firstName", "lastName"], ["p2Name"], ["p3Name"]],
    label: "Celé jméno, nebo Jméno + Příjmení (případně jméno další osoby)",
  },
};

export const IMPORT_ENTITIES: { value: ImportEntity; label: string; description: string }[] = [
  { value: "company", label: "Kluby", description: "Název, IČO, sport, liga, kontaktní údaje…" },
  { value: "contact", label: "Kontakty", description: "Jméno, e-mail, telefon, klub i tým" },
  { value: "lead", label: "Leady", description: "Nové obchodní příležitosti k dokvalifikaci" },
  { value: "product", label: "Produkty", description: "Katalog produktů a služeb" },
];

export const IMPORT_FIELDS: Record<ImportEntity, ImportField[]> = {
  company: [
    { key: "name", label: "Název klubu", required: true, example: "TJ Sokol Florbal" },
    { key: "registrationNumber", label: "IČO", example: "12345678" },
    { key: "vatNumber", label: "DIČ", example: "CZ12345678" },
    { key: "sport", label: "Sport", example: "Florbal" },
    { key: "league", label: "Liga / soutěž", example: "1. liga muži" },
    { key: "industry", label: "Obor", example: "Sport" },
    { key: "segment", label: "Segment", example: "SMB" },
    { key: "website", label: "Web", example: "www.klub.cz" },
    { key: "phone", label: "Telefon", example: "+420 123 456 789" },
    { key: "email", label: "E-mail", example: "info@klub.cz" },
    { key: "billingCity", label: "Město", example: "Praha" },
    { key: "source", label: "Zdroj", example: "Veletrh" },
  ],
  contact: [
    { key: "fullName", label: "Celé jméno", example: "Jana Nováková", aliases: ["kontaktni_osoba", "kontaktní osoba", "jméno a příjmení", "full name"] },
    { key: "firstName", label: "Jméno", example: "Jana" },
    { key: "lastName", label: "Příjmení", example: "Nováková" },
    { key: "email", label: "E-mail", example: "jana.novakova@klub.cz" },
    { key: "phone", label: "Telefon", example: "+420 123 456 789", aliases: ["telefon", "tel"] },
    { key: "mobile", label: "Mobil", example: "+420 601 234 567" },
    { key: "jobTitle", label: "Pozice", example: "Trenérka" },
    { key: "companyName", label: "Klub (podle názvu)", example: "TJ Sokol Florbal", aliases: ["klub", "club"] },
    { key: "companyId", label: "Klub – ID v CRM", example: "cmufa5ind0000la04yaiat7t6" },
    { key: "teamCategory", label: "Tým – kategorie", example: "U17 dorostenci", aliases: ["kategorie", "category"] },
    { key: "teamLeague", label: "Tým – soutěž", example: "1. liga dorostenců", aliases: ["soutez", "soutěž", "liga týmu"] },
    { key: "teamName", label: "Tým – název", example: "Zlín Lions B", aliases: ["tym", "tým", "druzstvo", "družstvo"] },
    { key: "role", label: "Role (v klubu / týmu)", example: "Trenér", aliases: ["role"] },
    // A row can carry more people of the same club (e.g. secretary and chairman next to
    // the team's contact person). They are linked to the club; their role is taken from
    // the mapped role column, else from the name column's header ("sekretar_klubu" →
    // "Sekretář klubu").
    { key: "p2Name", label: "Další osoba 2 – celé jméno", example: "Petr Svoboda", aliases: ["sekretar_klubu", "sekretář", "sekretar"] },
    { key: "p2Email", label: "Další osoba 2 – e-mail", aliases: ["sekretar_email"] },
    { key: "p2Phone", label: "Další osoba 2 – telefon", aliases: ["sekretar_tel", "sekretar_telefon"] },
    { key: "p2Role", label: "Další osoba 2 – role", example: "Sekretář klubu" },
    { key: "p3Name", label: "Další osoba 3 – celé jméno", example: "Jan Dvořák", aliases: ["predseda", "předseda"] },
    { key: "p3Email", label: "Další osoba 3 – e-mail", aliases: ["predseda_email"] },
    { key: "p3Phone", label: "Další osoba 3 – telefon", aliases: ["predseda_tel", "predseda_telefon"] },
    { key: "p3Role", label: "Další osoba 3 – role", example: "Předseda klubu" },
  ],
  lead: [
    { key: "firstName", label: "Jméno", example: "Petr" },
    { key: "lastName", label: "Příjmení", example: "Svoboda" },
    { key: "companyName", label: "Klub", example: "Nový Klub Florbal" },
    { key: "email", label: "E-mail", example: "petr@novyklub.cz" },
    { key: "phone", label: "Telefon", example: "+420 601 234 567" },
    { key: "source", label: "Zdroj", example: "Web" },
    { key: "estimatedValue", label: "Odhadovaná hodnota", example: "150000" },
  ],
  product: [
    { key: "name", label: "Název", required: true, example: "Konzultační hodiny" },
    { key: "code", label: "Kód", example: "SVC-CONSULT" },
    { key: "category", label: "Kategorie", example: "Konzultace" },
    { key: "price", label: "Cena bez DPH", example: "1500" },
    { key: "vatRate", label: "DPH %", example: "21" },
    { key: "unit", label: "Jednotka", example: "hod" },
  ],
};

// Readable role from a column header, for extra people without a mapped role column.
export function roleFromHeader(header: string) {
  const h = header.toLowerCase();
  if (h.includes("sekret")) return "Sekretář klubu";
  if (h.includes("predsed") || h.includes("předsed")) return "Předseda klubu";
  if (h.includes("trener") || h.includes("trenér")) return "Trenér";
  if (h.includes("manaz") || h.includes("manaž")) return "Manažer";
  const text = header.replace(/[_-]+/g, " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : null;
}

// Field definitions for the CRM bulk-import wizard. Each config drives both the
// column-mapping UI and the row validation before the server action runs.

export type ImportEntity = "company" | "contact" | "lead" | "product";

export type ImportField = {
  key: string;
  label: string;
  required?: boolean;
  example?: string;
};

export const IMPORT_ENTITIES: { value: ImportEntity; label: string; description: string }[] = [
  { value: "company", label: "Kluby", description: "Název, IČO, sport, liga, kontaktní údaje…" },
  { value: "contact", label: "Kontakty", description: "Jméno, e-mail, telefon, případně klub" },
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
    { key: "firstName", label: "Jméno", required: true, example: "Jana" },
    { key: "lastName", label: "Příjmení", required: true, example: "Nováková" },
    { key: "email", label: "E-mail", example: "jana.novakova@klub.cz" },
    { key: "phone", label: "Telefon", example: "+420 123 456 789" },
    { key: "mobile", label: "Mobil", example: "+420 601 234 567" },
    { key: "jobTitle", label: "Pozice", example: "Marketingová ředitelka" },
    { key: "companyName", label: "Klub (podle názvu)", example: "TJ Sokol Florbal" },
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

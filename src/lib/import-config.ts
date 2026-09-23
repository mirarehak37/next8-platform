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
  { value: "company", label: "Firmy", description: "Název, IČO, obor, kontaktní údaje…" },
  { value: "contact", label: "Kontakty", description: "Jméno, e-mail, telefon, případně firma" },
  { value: "lead", label: "Leady", description: "Nové obchodní příležitosti k dokvalifikaci" },
  { value: "product", label: "Produkty", description: "Katalog produktů a služeb" },
];

export const IMPORT_FIELDS: Record<ImportEntity, ImportField[]> = {
  company: [
    { key: "name", label: "Název firmy", required: true, example: "GreenTech Solutions s.r.o." },
    { key: "registrationNumber", label: "IČO", example: "12345678" },
    { key: "vatNumber", label: "DIČ", example: "CZ12345678" },
    { key: "industry", label: "Obor", example: "IT a software" },
    { key: "segment", label: "Segment", example: "SMB" },
    { key: "website", label: "Web", example: "www.firma.cz" },
    { key: "phone", label: "Telefon", example: "+420 123 456 789" },
    { key: "email", label: "E-mail", example: "info@firma.cz" },
    { key: "billingCity", label: "Město", example: "Praha" },
    { key: "source", label: "Zdroj", example: "Veletrh" },
  ],
  contact: [
    { key: "firstName", label: "Jméno", required: true, example: "Jana" },
    { key: "lastName", label: "Příjmení", required: true, example: "Nováková" },
    { key: "email", label: "E-mail", example: "jana.novakova@firma.cz" },
    { key: "phone", label: "Telefon", example: "+420 123 456 789" },
    { key: "mobile", label: "Mobil", example: "+420 601 234 567" },
    { key: "jobTitle", label: "Pozice", example: "Marketingová ředitelka" },
    { key: "companyName", label: "Firma (podle názvu)", example: "GreenTech Solutions s.r.o." },
  ],
  lead: [
    { key: "firstName", label: "Jméno", example: "Petr" },
    { key: "lastName", label: "Příjmení", example: "Svoboda" },
    { key: "companyName", label: "Firma", example: "Nová Firma s.r.o." },
    { key: "email", label: "E-mail", example: "petr@novafirma.cz" },
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

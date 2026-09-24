// Central catalog of status/type vocabularies used across the platform.
// Kept as plain string unions (not Prisma enums) so the schema stays portable
// across SQLite (dev) and PostgreSQL (production) without a migration rewrite.

export const ENTITY_TYPES = {
  COMPANY: "company",
  CONTACT: "contact",
  LEAD: "lead",
  DEAL: "deal",
  QUOTE: "quote",
  PRODUCT: "product",
  TASK: "task",
  ACTIVITY: "activity",
} as const;
export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

export const COMPANY_STATUSES = [
  { value: "prospect", label: "Prospekt", color: "slate" },
  { value: "active", label: "Aktivní zákazník", color: "emerald" },
  { value: "inactive", label: "Neaktivní", color: "amber" },
  { value: "lost", label: "Ztracený", color: "rose" },
] as const;

export const CONTACT_STATUSES = [
  { value: "active", label: "Aktivní", color: "emerald" },
  { value: "inactive", label: "Neaktivní", color: "slate" },
] as const;

export const LEAD_STATUSES = [
  { value: "new", label: "Nový", color: "sky" },
  { value: "to_contact", label: "Kontaktovat", color: "indigo" },
  { value: "contacted", label: "Kontaktován", color: "violet" },
  { value: "qualifying", label: "Kvalifikace", color: "amber" },
  { value: "qualified", label: "Kvalifikovaný", color: "emerald" },
  { value: "unqualified", label: "Nekvalifikovaný", color: "rose" },
  { value: "converted", label: "Převeden", color: "emerald" },
] as const;

export const LEAD_RATINGS = [
  { value: "hot", label: "Horký", color: "rose" },
  { value: "warm", label: "Vlažný", color: "amber" },
  { value: "cold", label: "Studený", color: "sky" },
] as const;

export const DEAL_STATUSES = [
  { value: "open", label: "Otevřený", color: "sky" },
  { value: "won", label: "Vyhráno", color: "emerald" },
  { value: "lost", label: "Prohráno", color: "rose" },
] as const;

export const QUOTE_STATUSES = [
  { value: "draft", label: "Koncept", color: "slate" },
  { value: "pending_approval", label: "Ke schválení", color: "amber" },
  { value: "approved", label: "Schváleno", color: "indigo" },
  { value: "sent", label: "Odesláno", color: "sky" },
  { value: "accepted", label: "Přijato", color: "emerald" },
  { value: "rejected", label: "Odmítnuto", color: "rose" },
  { value: "expired", label: "Expirováno", color: "amber" },
] as const;

export const TASK_STATUSES = [
  { value: "open", label: "Otevřený", color: "sky" },
  { value: "in_progress", label: "Rozpracovaný", color: "amber" },
  { value: "done", label: "Hotový", color: "emerald" },
  { value: "cancelled", label: "Zrušený", color: "slate" },
] as const;

export const TASK_PRIORITIES = [
  { value: "low", label: "Nízká", color: "slate" },
  { value: "medium", label: "Střední", color: "sky" },
  { value: "high", label: "Vysoká", color: "amber" },
  { value: "urgent", label: "Urgentní", color: "rose" },
] as const;

export const ACTIVITY_TYPES = [
  { value: "call", label: "Telefonát", icon: "phone" },
  { value: "email", label: "E-mail", icon: "mail" },
  { value: "meeting", label: "Schůzka", icon: "users" },
  { value: "video_call", label: "Videohovor", icon: "video" },
  { value: "note", label: "Poznámka", icon: "sticky-note" },
  { value: "presentation", label: "Prezentace", icon: "presentation" },
  { value: "other", label: "Jiná aktivita", icon: "circle-dot" },
] as const;

export const COMPANY_SIZE_BANDS = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

export const LEAD_SOURCES = [
  "Web",
  "Doporučení",
  "Veletrh",
  "Kampaň",
  "Studený telefonát",
  "LinkedIn",
  "Partner",
  "Jiné",
] as const;

export const ROADMAP_STATUSES = [
  { value: "backlog", label: "Nápad", color: "slate" },
  { value: "considering", label: "Ke zvážení", color: "sky" },
  { value: "planned", label: "Naplánováno", color: "indigo" },
  { value: "in_progress", label: "V realizaci", color: "amber" },
  { value: "testing", label: "Testování", color: "violet" },
  { value: "done", label: "Hotovo", color: "emerald" },
  { value: "rejected", label: "Zamítnuto", color: "rose" },
] as const;

export const ROADMAP_TYPES = [
  { value: "idea", label: "Nápad", color: "slate" },
  { value: "feature", label: "Nová funkce", color: "indigo" },
  { value: "improvement", label: "Vylepšení", color: "sky" },
  { value: "bug", label: "Chyba", color: "rose" },
  { value: "update", label: "Aktualizace / Epic", color: "violet" },
] as const;

export const ROADMAP_PRIORITIES = [
  { value: "low", label: "Nízká", color: "slate" },
  { value: "medium", label: "Střední", color: "sky" },
  { value: "high", label: "Vysoká", color: "amber" },
  { value: "critical", label: "Kritická", color: "rose" },
] as const;

export const ROADMAP_EFFORTS = [
  { value: "s", label: "S — dny" },
  { value: "m", label: "M — týden" },
  { value: "l", label: "L — týdny" },
  { value: "xl", label: "XL — měsíce" },
] as const;

export const ROADMAP_QUARTERS = ["Q4 2026", "Q1 2027", "Q2 2027", "Q3 2027", "Q4 2027"] as const;

export const INDUSTRIES = [
  "IT a software",
  "Výroba",
  "Stavebnictví",
  "Maloobchod",
  "Velkoobchod",
  "Logistika a doprava",
  "Finance a pojišťovnictví",
  "Zdravotnictví",
  "Vzdělávání",
  "Marketing a reklama",
  "Nemovitosti",
  "Pohostinství a cestovní ruch",
  "Energetika",
  "Zemědělství",
  "Veřejná správa",
  "Jiné",
] as const;

export const PRODUCT_CATEGORIES = [
  "Software",
  "Hardware",
  "Konzultace",
  "Implementace",
  "Podpora a servis",
  "Školení",
  "Licence",
  "Předplatné",
] as const;

// Dnes výhradně florbal, ale klientská základna se má rozšiřovat na další sporty —
// proto je pole u klubu kombobox s možností dopsat vlastní hodnotu, ne pevný enum.
export const SPORTS = [
  "Florbal",
  "Fotbal",
  "Hokej",
  "Basketbal",
  "Volejbal",
  "Házená",
  "Tenis",
  "Jiné",
] as const;

export const CLUB_TEAM_CATEGORIES = [
  "muži",
  "ženy",
  "veteráni",
  "U19 junioři",
  "U19 juniorky",
  "U17 dorostenci",
  "U17 dorostenky",
  "U15 starší žáci",
  "U15 starší žákyně",
  "U13 mladší žáci",
  "U13 mladší žákyně",
  "U11 starší elévové",
  "U11 starší elévky",
  "U9 mladší elévové",
  "U9 mladší elévky",
  "U7 přípravka",
] as const;

export const PRODUCT_UNITS = [
  { value: "ks", label: "ks" },
  { value: "hod", label: "hod" },
  { value: "den", label: "den" },
  { value: "měsíc", label: "měsíc" },
  { value: "rok", label: "rok" },
  { value: "balení", label: "balení" },
  { value: "licence", label: "licence" },
  { value: "GB", label: "GB" },
] as const;

// ---------------------------------------------------------------------------
// Partnerships — ambassadors and partners/sponsors
// ---------------------------------------------------------------------------

export const PARTNERSHIP_STATUSES = [
  { value: "candidate", label: "Kandidát", color: "slate" },
  { value: "negotiation", label: "Vyjednávání", color: "sky" },
  { value: "active", label: "Aktivní", color: "emerald" },
  { value: "paused", label: "Pozastaveno", color: "amber" },
  { value: "ended", label: "Ukončeno", color: "rose" },
] as const;

export const AMBASSADOR_TIERS = [
  { value: "top", label: "Top ambasador", color: "indigo" },
  { value: "standard", label: "Standard", color: "sky" },
  { value: "micro", label: "Micro influencer", color: "violet" },
] as const;

export const AMBASSADOR_POSITIONS = ["Útočník", "Obránce", "Brankář", "Trenér", "Influencer", "Jiné"] as const;

export const AMBASSADOR_BILLING_TYPES = [
  { value: "invoice", label: "Faktura (OSVČ)" },
  { value: "dpp", label: "DPP" },
  { value: "barter", label: "Barter (bez peněz)" },
  { value: "none", label: "Neplaceno" },
] as const;

export const PARTNER_KINDS = [
  { value: "next8_partner", label: "Partner NEXT8", color: "indigo" },
  { value: "club_sponsor", label: "Sponzor klubu", color: "violet" },
] as const;

export const PARTNER_LEVELS = ["Generální", "Hlavní", "Oficiální", "Technický", "Mediální", "Dodavatel", "Podporovatel"] as const;

// Term vocabularies per module and direction ("we_give" = NEXT8 provides,
// "they_give" = what the ambassador / partner must deliver in return).
export const TERM_TYPES = {
  ambassador: {
    we_give: [
      { value: "fee", label: "Pravidelná odměna" },
      { value: "one_off_fee", label: "Jednorázová odměna" },
      { value: "bonus", label: "Bonus / provize" },
      { value: "products", label: "Produkty / vybavení" },
      { value: "services", label: "Služby NEXT8" },
      { value: "discount", label: "Sleva / slevový kód" },
      { value: "other", label: "Jiné" },
    ],
    they_give: [
      { value: "post", label: "Příspěvek na sociálních sítích" },
      { value: "story", label: "Story / reels" },
      { value: "event", label: "Účast na akci" },
      { value: "photo_shoot", label: "Focení / natáčení" },
      { value: "wear", label: "Nošení / používání produktů" },
      { value: "referral", label: "Doporučení / přivedení zákazníků" },
      { value: "other", label: "Jiné" },
    ],
  },
  partner: {
    we_give: [
      { value: "visibility", label: "Logo / viditelnost" },
      { value: "promotion", label: "Propagace na sítích a webu" },
      { value: "tickets", label: "Vstupenky / VIP" },
      { value: "products", label: "Produkty / vybavení" },
      { value: "services", label: "Služby NEXT8" },
      { value: "fee", label: "Finanční plnění" },
      { value: "other", label: "Jiné" },
    ],
    they_give: [
      { value: "payment", label: "Finanční plnění" },
      { value: "goods", label: "Věcné plnění / produkty" },
      { value: "services", label: "Služby" },
      { value: "discount", label: "Sleva pro NEXT8 / členy" },
      { value: "event", label: "Akce / aktivace" },
      { value: "other", label: "Jiné" },
    ],
  },
} as const satisfies Record<"ambassador" | "partner", Record<"we_give" | "they_give", readonly { value: string; label: string }[]>>;

export function termTypes(subjectType: "ambassador" | "partner", direction: "we_give" | "they_give"): readonly { value: string; label: string }[] {
  return TERM_TYPES[subjectType][direction];
}

export const TERM_PERIODS = [
  { value: "one_off", label: "Jednorázově", short: "celkem" },
  { value: "monthly", label: "Měsíčně", short: "měs." },
  { value: "quarterly", label: "Čtvrtletně", short: "čtvrtletí" },
  { value: "season", label: "Za sezónu", short: "sezóna" },
  { value: "yearly", label: "Ročně", short: "rok" },
  { value: "per_event", label: "Při každém prodeji / události", short: "prodej" },
] as const;

export const TERM_VALUE_TYPES = [
  { value: "fixed", label: "Pevná částka (Kč)" },
  { value: "percent", label: "Procenta (provize)" },
] as const;

export const ATTACHMENT_CATEGORIES = [
  { value: "contract", label: "Smlouva" },
  { value: "amendment", label: "Dodatek" },
  { value: "invoice", label: "Faktura" },
  { value: "brief", label: "Brief / podklady" },
  { value: "other", label: "Jiné" },
] as const;

export function findMeta<T extends { value: string; label: string; color?: string }>(
  list: readonly T[],
  value: string | null | undefined,
): T | undefined {
  return list.find((item) => item.value === value);
}

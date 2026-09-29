// The 14 Czech regions (kraje). Kept free of data imports so client forms can use it.

export const KRAJE = [
  { code: "PHA", label: "Praha" },
  { code: "STC", label: "Středočeský" },
  { code: "JHC", label: "Jihočeský" },
  { code: "PLK", label: "Plzeňský" },
  { code: "KVK", label: "Karlovarský" },
  { code: "ULK", label: "Ústecký" },
  { code: "LBK", label: "Liberecký" },
  { code: "HKK", label: "Královéhradecký" },
  { code: "PAK", label: "Pardubický" },
  { code: "VYS", label: "Vysočina" },
  { code: "JHM", label: "Jihomoravský" },
  { code: "OLK", label: "Olomoucký" },
  { code: "ZLK", label: "Zlínský" },
  { code: "MSK", label: "Moravskoslezský" },
] as const;
export type KrajCode = (typeof KRAJE)[number]["code"];

export function krajLabel(code: string | null | undefined) {
  return KRAJE.find((k) => k.code === code)?.label ?? null;
}

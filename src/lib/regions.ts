// Czech regions (kraje) and resolving a club's region from what we know about it.
// Municipality data: github.com/33bcdd/souradnice-mest ("volně k použití"), ČSÚ municipalities as of 2018.

import municipalities from "@/data/cz-municipalities.json";
import { KRAJE, type KrajCode } from "@/lib/kraje";

export { KRAJE, krajLabel, type KrajCode } from "@/lib/kraje";

// [name, krajCode, psč, lat, lon]
type Muni = [string, KrajCode, string, number, number];
const MUNIS = municipalities as Muni[];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const byName = new Map<string, Muni[]>();
for (const m of MUNIS) {
  const k = norm(m[0]);
  byName.set(k, [...(byName.get(k) ?? []), m]);
}

// "Praha 4", "Brno-Líšeň", "Ostrava - Poruba", "Frýdek-Místek" → try the full name first, then the part before a district suffix.
function candidates(city: string) {
  const full = norm(city);
  const keys = [full, full.replace(/\s+\d+$/, ""), full.split(",")[0], full.split("-")[0]];
  for (const k of keys) {
    const hit = byName.get(k.trim());
    if (hit) return hit;
  }
  return [];
}

// Florbal competitions are regional ("PH a SČ liga", "Olomoucký přebor", "Karlovarská a Plzeňská liga"),
// so a club's leagues tell which of several same-named towns it is.
const LEAGUE_HINTS: [RegExp, KrajCode[]][] = [
  [/PH a SČ|pražsk|středočes/i, ["PHA", "STC"]],
  [/jihočes/i, ["JHC"]],
  [/plzeň/i, ["PLK"]],
  [/karlovar/i, ["KVK"]],
  [/úst(ec|ek)/i, ["ULK"]],
  [/libere/i, ["LBK"]],
  [/královéhrad/i, ["HKK"]],
  [/pardubic/i, ["PAK"]],
  [/vysočin/i, ["VYS"]],
  [/jihomorav/i, ["JHM"]],
  [/olomouc/i, ["OLK"]],
  [/zlín/i, ["ZLK"]],
  [/moravskoslez/i, ["MSK"]],
];

function leagueRegions(leagues: (string | null | undefined)[]) {
  const set = new Set<KrajCode>();
  for (const l of leagues) if (l) for (const [re, codes] of LEAGUE_HINTS) if (re.test(l)) codes.forEach((c) => set.add(c));
  return set;
}

// Well-known towns whose name is shared with small villages elsewhere.
const PREFERRED: Record<string, KrajCode> = {
  kladno: "STC", milovice: "STC", adamov: "JHM", tachov: "PLK", hlinsko: "PAK", horice: "HKK", zatec: "ULK",
  hranice: "OLK", ricany: "STC", rudna: "STC", ostrov: "KVK", rosice: "JHM", mohelnice: "OLK", kyjov: "JHM",
  pisek: "JHC", pribyslav: "VYS", pohorelice: "JHM", jesenice: "STC", vyskov: "JHM", lety: "STC", brezi: "JHM",
};

export type ResolvedPlace = { region: KrajCode | null; lat: number | null; lon: number | null; guessed: boolean };

// Manual region wins; otherwise the city (disambiguated by PSČ when several towns share a name).
export function resolvePlace(c: { region?: string | null; city?: string | null; zip?: string | null; leagues?: (string | null | undefined)[] }): ResolvedPlace {
  const zip = c.zip?.replace(/\s/g, "") ?? "";
  let hits = c.city ? candidates(c.city) : [];
  if (hits.length > 1 && zip) {
    const same = hits.filter((m) => m[2] === zip);
    const near = same.length ? same : hits.filter((m) => m[2].slice(0, 3) === zip.slice(0, 3));
    if (near.length) hits = near;
  }
  if (hits.length > 1 && c.leagues?.length) {
    const hint = leagueRegions(c.leagues);
    const inHint = hits.filter((m) => hint.has(m[1]));
    if (inHint.length) hits = inHint;
  }
  if (hits.length > 1 && c.city) {
    const pref = PREFERRED[norm(c.city)];
    const inPref = hits.filter((m) => m[1] === pref);
    if (inPref.length) hits = inPref;
  }
  const m = hits[0];
  const manual = KRAJE.some((k) => k.code === c.region) ? (c.region as KrajCode) : null;
  if (manual) {
    const inRegion = hits.find((h) => h[1] === manual);
    return { region: manual, lat: inRegion?.[3] ?? null, lon: inRegion?.[4] ?? null, guessed: false };
  }
  if (!m) return { region: null, lat: null, lon: null, guessed: false };
  return { region: m[1], lat: m[3], lon: m[4], guessed: new Set(hits.map((h) => h[1])).size > 1 };
}

// Parses the NEXT8 monthly content-plan spreadsheet (sheets "Plán", "Stories",
// "Týdny a pravidla", "Měření") into data the CRM can store. Pure: the import page
// runs it in the browser, the MCP tool receives its output.

export type PlanPost = {
  planKey: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:mm, Prague
  title: string;
  status: string;
  format: string | null;
  audience: string | null;
  pillar: string | null;
  hook: string | null;
  brief: string | null;
  variant: string | null;
  materials: string | null;
  cta: string | null;
  goal: string | null;
  storyPlan: string | null;
  template: string | null;
  caption: string | null;
  hashtags: string | null;
  notes: string | null;
};

export type PlanWeek = {
  week: number;
  startDate: string | null;
  endDate: string | null;
  theme: string | null;
  reach: number | null;
  saves: number | null;
  shares: number | null;
  newFollowers: number | null;
  bioClicks: number | null;
  newTeams: number | null;
  bestPost: string | null;
  nextChange: string | null;
};

export type ContentPlan = {
  campaign: { name: string; description: string | null; startDate: string | null; endDate: string | null };
  posts: PlanPost[];
  weeks: PlanWeek[];
};

type Sheet = string[][];

const STATUS: Record<string, string> = {
  "nápad": "idea",
  "čeká na podklady": "draft",
  "připraveno": "review",
  "hotovo": "scheduled",
  "publikováno": "published",
  "zrušeno": "cancelled",
};
const FORMAT: Record<string, string> = { carousel: "carousel", post: "post", story: "story", reels: "reel", reel: "reel", video: "video" };
const AUDIENCE: Record<string, string> = { "hráči": "player", "trenéři": "coach", "rodiče": "parent", "kluby": "club", "všichni": "all" };

export const STATUS_ORDER = ["idea", "draft", "review", "scheduled", "published"];

const clean = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};
const key = (v: unknown) => String(v ?? "").trim().toLowerCase();

// Excel serial (46339), ISO (2026-11-16) or Czech (16. 11. 2026) → YYYY-MM-DD.
export function planDate(v: unknown, fallbackYear = new Date().getFullYear()): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const cz = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})?/);
  if (cz) return `${cz[3] ?? fallbackYear}-${cz[2].padStart(2, "0")}-${cz[1].padStart(2, "0")}`;
  return null;
}

function planTime(v: unknown) {
  const m = String(v ?? "").match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

const int = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return String(v ?? "").trim() !== "" && Number.isFinite(n) ? Math.round(n) : null;
};

// Rows below the header row whose first cell is `first`, as header → value objects.
function table(sheet: Sheet | undefined, first: string) {
  if (!sheet) return [];
  const at = sheet.findIndex((r) => key(r[0]) === first.toLowerCase());
  if (at === -1) return [];
  const headers = sheet[at].map(key);
  const rows: Record<string, string>[] = [];
  for (const r of sheet.slice(at + 1)) {
    if (!r.some((c) => String(c ?? "").trim())) break;
    rows.push(Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? "")])));
  }
  return rows;
}

// Free-form sections after the tables: a one-cell row is a heading, two cells are
// "label: text". Header rows of the small tables ("Co | Pravidlo"…) are skipped.
const SECTION_HEADERS = new Set(["pravidlo", "co v ní je", "období"]);
function textSections(sheet: Sheet | undefined, afterFirst: string) {
  if (!sheet) return [];
  const at = sheet.findIndex((r) => key(r[0]) === afterFirst.toLowerCase());
  let i = at === -1 ? 0 : at + 1;
  while (at !== -1 && i < sheet.length && sheet[i].some((c) => String(c ?? "").trim())) i++;
  const out: string[] = [];
  for (const r of sheet.slice(i)) {
    const cells = r.map((c) => String(c ?? "").trim()).filter(Boolean);
    if (cells.length === 1) out.push(`\n${cells[0]}`);
    else if (cells.length >= 2 && !SECTION_HEADERS.has(key(cells[1])))
      out.push(`• ${cells[0]}: ${cells.slice(1).join(" ")}`);
  }
  return out;
}

const hashtagsOf = (text: string | null) => {
  const tags = text?.match(/#[\p{L}\p{N}_]+/gu);
  return tags?.length ? [...new Set(tags)].join(" ") : null;
};

export function parseContentPlan(sheets: Record<string, Sheet>): ContentPlan {
  const plan = sheets["Plán"] ?? Object.values(sheets)[0] ?? [];
  const title = clean(plan[0]?.[0]) ?? "Obsahový plán";
  const intro = [clean(plan[1]?.[0]), clean(plan[2]?.[0])].filter(Boolean).join("\n\n");
  const year = Number(title.match(/(20\d{2})/)?.[1]) || new Date().getFullYear();

  const posts: PlanPost[] = [];
  const perDay = new Map<string, number>();
  for (const r of table(plan, "Datum")) {
    const date = planDate(r["datum"], year);
    const topic = clean(r["téma"]) ?? clean(r["háček / nadpis"]);
    if (!date || !topic) continue;
    const n = (perDay.get(date) ?? 0) + 1;
    perDay.set(date, n);
    const caption = clean(r["popisek ke zkopírování"]);
    posts.push({
      planKey: `post:${date}${n > 1 ? `:${n}` : ""}`,
      date,
      time: planTime(r["čas"]),
      title: topic,
      status: STATUS[key(r["stav"])] ?? "idea",
      format: FORMAT[key(r["formát"])] ?? null,
      audience: AUDIENCE[key(r["cílovka"])] ?? null,
      pillar: clean(r["rubrika"]),
      hook: clean(r["háček / nadpis"]),
      brief: clean(r["obsah"]),
      variant: clean(r["varianta"]),
      materials: clean(r["podklady"]),
      cta: clean(r["cta"]),
      goal: clean(r["cíl"]),
      storyPlan: clean(r["story ten den"]),
      template: clean(r["šablona / formát"]),
      caption,
      hashtags: hashtagsOf(caption),
      notes: null,
    });
  }

  for (const r of table(sheets["Stories"], "Datum")) {
    const date = planDate(r["datum"], year);
    const what = clean(r["co je na story"]);
    if (!date || !what) continue;
    const notes = [
      clean(r["nálepka"]) && `Nálepka: ${clean(r["nálepka"])}`,
      clean(r["po příspěvku"]) && `Po příspěvku: ${clean(r["po příspěvku"])}`,
      clean(r["večer"]) && `Večer: ${clean(r["večer"])}`,
    ].filter(Boolean).join("\n");
    posts.push({
      planKey: `story:${date}`,
      date,
      time: "07:15",
      title: `Story: ${what}`,
      status: STATUS[key(r["stav"])] ?? "idea",
      format: "story",
      audience: null,
      pillar: clean(r["formát (ráno 7:15)"]) ?? clean(Object.entries(r).find(([h]) => h.startsWith("formát"))?.[1]),
      hook: what,
      brief: null,
      variant: null,
      materials: clean(r["soubor"]),
      cta: null,
      goal: null,
      storyPlan: null,
      template: null,
      caption: null,
      hashtags: null,
      notes: notes || null,
    });
  }

  const rules = sheets["Týdny a pravidla"];
  const themes = new Map(
    table(rules, "Týden").map((r) => [
      int(r["týden"]),
      [clean(r["hráči"]) && `Hráči: ${clean(r["hráči"])}`, clean(r["trenéři a kluby"]) && `Trenéři a kluby: ${clean(r["trenéři a kluby"])}`]
        .filter(Boolean)
        .join("\n"),
    ]),
  );
  const ruleLines = [...textSections(rules, "Týden"), ...textSections(sheets["Stories"], "Datum").map((l) => (l === "\nPravidla" ? "\nPravidla stories" : l))];

  const weeks: PlanWeek[] = [];
  for (const r of table(sheets["Měření"], "Týden")) {
    const week = int(r["týden"]);
    if (week == null) continue;
    weeks.push({
      week,
      startDate: planDate(r["od"], year),
      endDate: planDate(r["do"], year),
      theme: themes.get(week) || null,
      reach: int(r["dosah"]),
      saves: int(r["uložení"]),
      shares: int(r["sdílení"]),
      newFollowers: int(r["noví sledující"]),
      bioClicks: int(r["kliky v biu"]),
      newTeams: int(r["nové týmy"]),
      bestPost: clean(r["nejlepší příspěvek"]),
      nextChange: clean(r["co příště změnit"]),
    });
  }
  for (const [week, theme] of themes) {
    if (week != null && !weeks.some((w) => w.week === week)) {
      weeks.push({ week, startDate: null, endDate: null, theme: theme || null, reach: null, saves: null, shares: null, newFollowers: null, bioClicks: null, newTeams: null, bestPost: null, nextChange: null });
    }
  }
  weeks.sort((a, b) => a.week - b.week);

  const dates = posts.map((p) => p.date).sort();
  const description = [intro, ruleLines.join("\n").trim()].filter(Boolean).join("\n\n");

  return {
    campaign: { name: title, description: description || null, startDate: dates[0] ?? null, endDate: dates[dates.length - 1] ?? null },
    posts,
    weeks,
  };
}

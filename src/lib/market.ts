import { prisma } from "@/lib/prisma";
import { ownerScopeWhere, type SessionUser } from "@/lib/scope";
import { KRAJE, resolvePlace, type KrajCode } from "@/lib/regions";

// Market coverage: every club and team gets one state, derived from deals and recent contact.
export const MARKET_STATES = [
  { value: "customer", label: "Zákazník", color: "emerald", fill: "#10b981" },
  { value: "negotiating", label: "Jednáme", color: "amber", fill: "#f59e0b" },
  { value: "contacted", label: "Osloveno", color: "sky", fill: "#0ea5e9" },
  { value: "lost", label: "Prohráno", color: "rose", fill: "#f43f5e" },
  { value: "untouched", label: "Neosloveno", color: "slate", fill: "#94a3b8" },
] as const;
export type MarketState = (typeof MARKET_STATES)[number]["value"];
const RANK: Record<MarketState, number> = { customer: 0, negotiating: 1, contacted: 2, lost: 3, untouched: 4 };
const best = (a: MarketState, b: MarketState) => (RANK[a] <= RANK[b] ? a : b);

// Contact older than this doesn't count as "osloveno" any more.
const CONTACT_DAYS = 180;

export type MarketFilters = { sport?: string; category?: string; league?: string; owner?: string };

export type MarketTeam = { id: string; category: string; league: string | null; state: MarketState };
export type MarketClub = {
  id: string;
  name: string;
  city: string | null;
  region: KrajCode | null;
  regionGuessed: boolean;
  lat: number | null;
  lon: number | null;
  ownerName: string;
  state: MarketState;
  teams: MarketTeam[];
  wonValue: number;
  openDeals: number;
};

export type Counts = Record<MarketState, number> & { total: number };
const emptyCounts = (): Counts => ({ customer: 0, negotiating: 0, contacted: 0, lost: 0, untouched: 0, total: 0 });
function add(c: Counts, s: MarketState) {
  c[s]++;
  c.total++;
}

function dealState(statuses: string[]): MarketState | null {
  if (statuses.includes("won")) return "customer";
  if (statuses.includes("open")) return "negotiating";
  if (statuses.includes("lost")) return "lost";
  return null;
}

export async function loadMarket(user: SessionUser, f: MarketFilters) {
  const scope = await ownerScopeWhere(user, "company");
  const since = new Date(Date.now() - CONTACT_DAYS * 86400000);

  const [companies, deals, contacted, ambassadors] = await Promise.all([
    prisma.company.findMany({
      where: { ...scope, ...(f.sport ? { sport: f.sport } : {}), ...(f.owner ? { ownerId: f.owner } : {}) },
      select: {
        id: true, name: true, billingCity: true, billingZip: true, region: true, league: true, sport: true,
        owner: { select: { name: true } },
        clubTeams: { select: { id: true, category: true, league: true } },
      },
    }),
    prisma.deal.findMany({ where: { tenantId: user.tenantId, companyId: { not: null } }, select: { companyId: true, clubTeamId: true, status: true, value: true } }),
    prisma.activity.groupBy({ by: ["subjectId"], where: { tenantId: user.tenantId, subjectType: "company", activityAt: { gte: since } } }),
    prisma.ambassador.findMany({
      where: { tenantId: user.tenantId, status: { in: ["active", "negotiation"] } },
      select: { id: true, firstName: true, lastName: true, status: true, company: { select: { billingCity: true, billingZip: true, region: true, league: true } } },
    }),
  ]);

  const contactedIds = new Set(contacted.map((a) => a.subjectId));
  const teamDeals = new Map<string, string[]>();
  const clubDeals = new Map<string, string[]>(); // deals without a team apply to the whole club
  const wonValue = new Map<string, number>();
  const openCount = new Map<string, number>();
  for (const d of deals) {
    if (d.clubTeamId) teamDeals.set(d.clubTeamId, [...(teamDeals.get(d.clubTeamId) ?? []), d.status]);
    else clubDeals.set(d.companyId!, [...(clubDeals.get(d.companyId!) ?? []), d.status]);
    if (d.status === "won") wonValue.set(d.companyId!, (wonValue.get(d.companyId!) ?? 0) + d.value);
    if (d.status === "open") openCount.set(d.companyId!, (openCount.get(d.companyId!) ?? 0) + 1);
  }

  const clubs: MarketClub[] = [];
  for (const c of companies) {
    // A deal without a team makes the club a customer / negotiation, but says nothing about which
    // squads use NEXT8 — its other teams count as "osloveno" (an upsell), not as customers.
    const clubLevel = dealState(clubDeals.get(c.id) ?? []);
    const fallback: MarketState = clubLevel === "lost" ? "lost" : clubLevel || contactedIds.has(c.id) ? "contacted" : "untouched";
    const teams = c.clubTeams
      .filter((t) => (!f.category || t.category === f.category) && (!f.league || t.league === f.league))
      .map((t) => {
        const own = dealState(teamDeals.get(t.id) ?? []);
        return { id: t.id, category: t.category, league: t.league, state: own ? best(own, fallback) : fallback };
      });
    // Filtering by category/league keeps only clubs that field such a team.
    if ((f.category || f.league) && teams.length === 0) continue;
    const state = teams.reduce<MarketState>((s, t) => best(s, t.state), clubLevel ? best(clubLevel, fallback) : fallback);
    const place = resolvePlace({ region: c.region, city: c.billingCity, zip: c.billingZip, leagues: [c.league, ...c.clubTeams.map((t) => t.league)] });
    clubs.push({
      id: c.id, name: c.name, city: c.billingCity, region: place.region, regionGuessed: place.guessed, lat: place.lat, lon: place.lon,
      ownerName: c.owner.name, state, teams, wonValue: wonValue.get(c.id) ?? 0, openDeals: openCount.get(c.id) ?? 0,
    });
  }

  type RegionRow = {
    code: KrajCode; label: string; clubs: Counts; teams: Counts; wonValue: number; coverage: number | null; potential: number;
    ambassadors: string[]; owners: [string, number][];
  };
  const regions = new Map<KrajCode, RegionRow>(
    KRAJE.map((k) => [k.code, { code: k.code, label: k.label, clubs: emptyCounts(), teams: emptyCounts(), wonValue: 0, coverage: null, potential: 0, ambassadors: [], owners: [] }]),
  );
  const ownerTally = new Map<KrajCode, Map<string, number>>();
  const totals = { clubs: emptyCounts(), teams: emptyCounts(), noRegion: 0 };
  const byLeague = new Map<string, Counts>();
  const byCategory = new Map<string, Counts>();

  for (const club of clubs) {
    add(totals.clubs, club.state);
    for (const t of club.teams) {
      add(totals.teams, t.state);
      const lg = t.league ?? "Bez soutěže";
      if (!byLeague.has(lg)) byLeague.set(lg, emptyCounts());
      add(byLeague.get(lg)!, t.state);
      if (!byCategory.has(t.category)) byCategory.set(t.category, emptyCounts());
      add(byCategory.get(t.category)!, t.state);
    }
    const r = club.region ? regions.get(club.region) : undefined;
    if (!r) {
      totals.noRegion++;
      continue;
    }
    add(r.clubs, club.state);
    club.teams.forEach((t) => add(r.teams, t.state));
    r.wonValue += club.wonValue;
    const tally = ownerTally.get(r.code) ?? new Map<string, number>();
    tally.set(club.ownerName, (tally.get(club.ownerName) ?? 0) + 1);
    ownerTally.set(r.code, tally);
  }

  for (const a of ambassadors) {
    if (!a.company) continue;
    const place = resolvePlace({ region: a.company.region, city: a.company.billingCity, zip: a.company.billingZip, leagues: [a.company.league] });
    if (place.region) regions.get(place.region)!.ambassadors.push(`${a.firstName} ${a.lastName}${a.status === "negotiation" ? " (jedná se)" : ""}`);
  }

  for (const r of regions.values()) {
    r.coverage = r.teams.total ? r.teams.customer / r.teams.total : null;
    r.potential = r.teams.untouched + r.teams.contacted;
    r.owners = [...(ownerTally.get(r.code) ?? new Map()).entries()].sort((a, b) => b[1] - a[1]);
  }

  const sortCounts = (m: Map<string, Counts>) => [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  return {
    clubs,
    regions: [...regions.values()],
    totals,
    byLeague: sortCounts(byLeague),
    byCategory: sortCounts(byCategory),
  };
}

export async function loadMarketFilterOptions(user: SessionUser) {
  const [sports, categories, leagues, owners] = await Promise.all([
    prisma.company.findMany({ where: { tenantId: user.tenantId, sport: { not: null } }, distinct: ["sport"], select: { sport: true } }),
    prisma.clubTeam.findMany({ where: { tenantId: user.tenantId }, distinct: ["category"], select: { category: true } }),
    prisma.clubTeam.findMany({ where: { tenantId: user.tenantId, league: { not: null } }, distinct: ["league"], select: { league: true } }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const cs = (a: string, b: string) => a.localeCompare(b, "cs");
  return {
    sports: sports.map((s) => s.sport!).sort(cs),
    categories: categories.map((c) => c.category).sort(cs),
    leagues: leagues.map((l) => l.league!).sort(cs),
    owners,
  };
}

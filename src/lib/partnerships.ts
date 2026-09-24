import { formatDate } from "@/lib/format";

// Pure helpers shared by the Ambassadors and Partners modules (server pages and
// client components alike) — period windows, progress and cost roll-ups.

export type FulfillmentLike = { date: Date | string; quantity: number; amount: number | null; rewardAmount?: number | null };

export type BonusTier = { threshold: number; amount: number };

// Tiers are stored as JSON; tolerate anything malformed and keep them ascending.
export function parseBonusTiers(value: unknown): BonusTier[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((t) => ({ threshold: Number(t?.threshold), amount: Number(t?.amount) }))
    .filter((t) => Number.isFinite(t.threshold) && t.threshold > 0 && Number.isFinite(t.amount))
    .sort((a, b) => a.threshold - b.threshold);
}

// What we owe for one logged delivery of an obligation: the per-piece reward plus
// the highest bonus tier the achieved metric (e.g. views) has reached.
export function deliveryReward(
  term: { rewardAmount?: number | null; bonusTiers?: unknown },
  quantity: number,
  metricValue: number | null | undefined,
) {
  const base = (term.rewardAmount ?? 0) * (quantity || 1);
  const reached = parseBonusTiers(term.bonusTiers).filter((t) => metricValue != null && metricValue >= t.threshold);
  const bonus = reached.length ? reached[reached.length - 1].amount : 0;
  return { base, bonus, total: base + bonus };
}

export function hasDeliveryReward(term: { rewardAmount?: number | null; bonusTiers?: unknown }) {
  return !!term.rewardAmount || parseBonusTiers(term.bonusTiers).length > 0;
}

export type TermLike = {
  direction: string;
  valueType?: string;
  amount: number | null;
  quantity: number | null;
  period: string;
  isActive: boolean;
  fulfillments?: FulfillmentLike[];
};

// Commission-style terms (a % of a sale, or paid per sale) have no fixed amount per
// period — their cost is whatever was actually logged.
export function isVariableTerm(term: Pick<TermLike, "valueType" | "period">) {
  return term.valueType === "percent" || term.period === "per_event";
}

export function oneYearAgo(now = new Date()) {
  const from = new Date(now);
  from.setFullYear(from.getFullYear() - 1);
  return from;
}

// Units and money logged in the last 12 months — the basis for variable terms.
export function trailingYear(fulfillments: FulfillmentLike[], now = new Date()) {
  const from = oneYearAgo(now);
  const recent = fulfillments.filter((f) => new Date(f.date) >= from);
  return {
    count: recent.reduce((s, f) => s + f.quantity, 0),
    amount: recent.reduce((s, f) => s + (f.amount ?? 0), 0),
  };
}

const YEARLY_MULTIPLIER: Record<string, number> = { monthly: 12, quarterly: 4, season: 1, yearly: 1, one_off: 1 };

// A floorball season runs from July to June.
export function currentSeasonLabel(now = new Date()) {
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
}

// The window a term's quota applies to right now; one-off terms count all-time.
export function periodWindow(period: string, now = new Date()): { start: Date; end: Date } | null {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case "monthly":
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
    case "quarterly": {
      const q = Math.floor(m / 3) * 3;
      return { start: new Date(y, q, 1), end: new Date(y, q + 3, 1) };
    }
    case "season": {
      const startYear = m >= 6 ? y : y - 1;
      return { start: new Date(startYear, 6, 1), end: new Date(startYear + 1, 6, 1) };
    }
    case "yearly":
      return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
    default:
      return null;
  }
}

// Progress of a term within its current period: delivered units for obligations,
// paid amount for money terms (falls back to units when the term has no amount).
export function termProgress(term: TermLike, fulfillments: FulfillmentLike[], now = new Date()) {
  if (isVariableTerm(term)) return { done: 0, target: null, ratio: null, measuresMoney: false };
  const window = periodWindow(term.period, now);
  const inWindow = window
    ? fulfillments.filter((f) => {
        const d = new Date(f.date);
        return d >= window.start && d < window.end;
      })
    : fulfillments;

  const measuresMoney = !!term.amount && term.quantity == null;
  const done = measuresMoney
    ? inWindow.reduce((s, f) => s + (f.amount ?? 0), 0)
    : inWindow.reduce((s, f) => s + f.quantity, 0);
  const target = measuresMoney ? term.amount : term.quantity;
  const ratio = target && target > 0 ? Math.min(done / target, 1) : null;
  return { done, target, ratio, measuresMoney };
}

// Rough yearly value of a set of terms in one direction: fixed terms extrapolated
// from their period (one-off counted once), variable terms from the last 12 months
// of logged fulfilments (only when the terms carry them). Our side also includes the
// rewards owed for delivered obligations (reels, posts…) over the last 12 months.
export function yearlyValue(terms: TermLike[], direction: "we_give" | "they_give") {
  const own = terms
    .filter((t) => t.isActive && t.direction === direction)
    .reduce((s, t) => {
      if (isVariableTerm(t)) return s + (t.fulfillments ? trailingYear(t.fulfillments).amount : 0);
      return s + (t.amount ?? 0) * (YEARLY_MULTIPLIER[t.period] ?? 1);
    }, 0);
  if (direction !== "we_give") return own;
  const from = oneYearAgo();
  const rewards = terms
    .filter((t) => t.direction === "they_give")
    .flatMap((t) => t.fulfillments ?? [])
    .filter((f) => new Date(f.date) >= from)
    .reduce((s, f) => s + (f.rewardAmount ?? 0), 0);
  return own + rewards;
}

// Rewards for delivered obligations that haven't been paid out yet.
export function unpaidRewards(terms: { fulfillments: { rewardAmount: number | null; paidAt: string | Date | null }[] }[]) {
  return terms
    .flatMap((t) => t.fulfillments)
    .filter((f) => f.rewardAmount && !f.paidAt)
    .reduce((s, f) => s + (f.rewardAmount ?? 0), 0);
}

// "15 % z předplatného" / "5 000 Kč / měs." style label for a term's value.
export function termValueLabel(
  term: Pick<TermLike, "valueType" | "amount" | "period"> & { percent?: number | null; percentBase?: string | null },
  formatMoney: (n: number) => string,
  periodShort?: string,
) {
  const per = term.period === "per_event" ? " za každý prodej" : periodShort && term.period !== "one_off" ? ` / ${periodShort}` : "";
  if (term.valueType === "percent") {
    if (term.percent == null) return null;
    const pct = `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(term.percent)} %`;
    // A percentage is inherently per sale, so only a non-sale period needs a suffix.
    return `${pct}${term.percentBase ? ` z ${term.percentBase.replace(/^z\s+/i, "")}` : ""}${term.period === "per_event" ? "" : per}`;
  }
  return term.amount ? `${formatMoney(term.amount)}${per}` : null;
}

export const EXPIRING_SOON_DAYS = 60;

export function contractState(contractEnd: Date | string | null | undefined, now = new Date()) {
  if (!contractEnd) return null;
  const days = Math.ceil((new Date(contractEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { days, label: "Smlouva vypršela", color: "rose" as const };
  if (days <= EXPIRING_SOON_DAYS) return { days, label: `Končí za ${days} dní`, color: "amber" as const };
  return { days, label: null, color: null };
}

export function contractRangeLabel(start: Date | null, end: Date | null) {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (end) return `do ${formatDate(end)}`;
  if (start) return `od ${formatDate(start)}, na dobu neurčitou`;
  return "nezadána";
}

export function toDateInput(value: Date | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : null;
}

// Social handles are stored as typed ("@petr", "petr" or a full URL).
export function socialUrl(network: "instagram" | "tiktok" | "youtube", value: string | null | undefined) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const handle = value.replace(/^@/, "");
  if (network === "instagram") return `https://instagram.com/${handle}`;
  if (network === "tiktok") return `https://tiktok.com/@${handle}`;
  return `https://youtube.com/@${handle}`;
}

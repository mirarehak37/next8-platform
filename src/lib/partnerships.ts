import { formatDate } from "@/lib/format";

// Pure helpers shared by the Ambassadors and Partners modules (server pages and
// client components alike) — period windows, progress and cost roll-ups.

export type TermLike = {
  direction: string;
  amount: number | null;
  quantity: number | null;
  period: string;
  isActive: boolean;
};

export type FulfillmentLike = { date: Date | string; quantity: number; amount: number | null };

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

// Rough yearly value of a set of terms in one direction (one-off terms counted once).
export function yearlyValue(terms: TermLike[], direction: "we_give" | "they_give") {
  return terms
    .filter((t) => t.isActive && t.direction === direction && t.amount)
    .reduce((s, t) => s + (t.amount ?? 0) * (YEARLY_MULTIPLIER[t.period] ?? 1), 0);
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

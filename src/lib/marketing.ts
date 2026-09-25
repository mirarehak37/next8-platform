// Pure helpers for the Marketing module.

export type PostMetrics = {
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
};

export function interactions(p: PostMetrics) {
  return (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0);
}

// Engagement rate = interactions / reach (falls back to impressions).
export function engagementRate(p: PostMetrics) {
  const base = p.reach || p.impressions;
  if (!base) return null;
  return interactions(p) / base;
}

export function formatPercent(v: number | null) {
  return v == null ? "—" : `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 }).format(v * 100)} %`;
}

export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function utmUrl(base: string, p: { source: string; medium: string; campaign: string; content?: string }) {
  try {
    const url = new URL(base.startsWith("http") ? base : `https://${base}`);
    url.searchParams.set("utm_source", p.source);
    url.searchParams.set("utm_medium", p.medium);
    url.searchParams.set("utm_campaign", p.campaign);
    if (p.content) url.searchParams.set("utm_content", p.content);
    return url.toString();
  } catch {
    return null;
  }
}

// <input type="datetime-local"> value from a Date (local time).
export function toDateTimeInput(d: Date | null | undefined) {
  if (!d) return null;
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

// Posts are scheduled to the minute; show them in Czech time even when the server runs in UTC.
export const MARKETING_TZ = "Europe/Prague";

export function formatPostTime(d: Date | string | null | undefined, withYear = false) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: MARKETING_TZ, weekday: "short", day: "numeric", month: "numeric", ...(withYear ? { year: "numeric" } : {}), hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

// Same instant expressed as a Date whose local fields match Prague wall-clock (for day bucketing on the server).
export function toPragueWallClock(d: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: MARKETING_TZ, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
}

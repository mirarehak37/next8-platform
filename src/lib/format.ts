// Every date in the app is shown in Czech time, regardless of where the server runs (Vercel = UTC).
export const APP_TZ = "Europe/Prague";

export function formatCurrency(value: number, currency = "CZK") {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function formatCurrencyCompact(value: number, currency = "CZK") {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("cs-CZ", { timeZone: APP_TZ, day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("cs-CZ", { timeZone: APP_TZ, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}

export function formatRelative(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const rtf = new Intl.RelativeTimeFormat("cs-CZ", { numeric: "auto" });
  if (Math.abs(diffDays) < 1) {
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    return rtf.format(diffHours, "hour");
  }
  return rtf.format(diffDays, "day");
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Date whose local fields equal the Prague wall-clock of `d` (for day bucketing / "today" on a UTC server).
export function toAppWallClock(d: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: APP_TZ, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
}

// Date-only fields (<input type="date">) are stored as UTC midnight. This is today's date in
// that same form, so "overdue" means strictly before today, not "earlier today".
export function todayDateOnly(now = new Date()) {
  const w = toAppWallClock(now);
  return new Date(Date.UTC(w.getFullYear(), w.getMonth(), w.getDate()));
}

// Parses a form value: ISO instants as-is; naive "YYYY-MM-DDTHH:mm" (datetime-local) as Prague time.
export function parseAppDateTime(v: string) {
  if (!/T\d{2}:\d{2}/.test(v) || /(Z|[+-]\d{2}:?\d{2})$/.test(v)) return new Date(v);
  const naive = new Date(`${v.length === 16 ? `${v}:00` : v}Z`); // wall-clock fields as if UTC
  const w = toAppWallClock(naive);
  const offset = Date.UTC(w.getFullYear(), w.getMonth(), w.getDate(), w.getHours(), w.getMinutes()) - naive.getTime();
  return new Date(naive.getTime() - offset);
}

export function formatCurrency(value: number, currency = "CZK") {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function formatCurrencyCompact(value: number, currency = "CZK") {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
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

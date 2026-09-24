// Shared numbers for the events list and detail pages.

export type RegistrationLike = { role: string; status: string; paymentStatus: string; amount: number | null };

export function eventStats(regs: RegistrationLike[], capacity: number | null) {
  const active = regs.filter((r) => r.status !== "cancelled");
  const participants = active.filter((r) => r.role === "participant");
  const paid = participants.filter((r) => r.paymentStatus === "paid").reduce((s, r) => s + (r.amount ?? 0), 0);
  const unpaid = participants.filter((r) => r.paymentStatus === "unpaid").reduce((s, r) => s + (r.amount ?? 0), 0);
  return {
    participants: participants.length,
    coaches: active.filter((r) => r.role === "coach").length,
    guests: active.filter((r) => r.role === "guest").length,
    attended: active.filter((r) => r.status === "attended").length,
    free: capacity != null ? Math.max(capacity - participants.length, 0) : null,
    fill: capacity ? Math.min(participants.length / capacity, 1) : null,
    paid,
    unpaid,
  };
}

export function eventDateLabel(start: Date, end: Date | null) {
  const fmt = (d: Date, withYear = true) =>
    new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", ...(withYear && { year: "numeric" }) }).format(d);
  if (!end || end.toDateString() === start.toDateString()) return fmt(start);
  return `${fmt(start, start.getFullYear() !== end.getFullYear())} – ${fmt(end)}`;
}

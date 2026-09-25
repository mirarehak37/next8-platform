import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { ownerScopeWhere } from "@/lib/scope";
import type { CalendarItem } from "@/components/calendar/month-calendar";
import { MARKETING_CHANNELS, findMeta } from "@/lib/constants";
import { toPragueWallClock } from "@/lib/marketing";

// One place that knows everything that belongs in the shared calendar, so the
// Kalendář page and the dashboard "Tento týden" agenda always agree.

export const CALENDAR_KINDS = [
  { value: "events", label: "Akce", tone: "brand" },
  { value: "tasks", label: "Úkoly", tone: "sky" },
  { value: "activities", label: "Schůzky a hovory", tone: "violet" },
  { value: "marketing", label: "Marketing", tone: "indigo" },
  { value: "content", label: "Obsah ambasadorů", tone: "amber" },
  { value: "deadlines", label: "Termíny splnění", tone: "amber" },
] as const;
export type CalendarKind = (typeof CALENDAR_KINDS)[number]["value"];

export type CalendarEntry = CalendarItem & {
  kind: CalendarKind;
  start: Date; // Prague wall-clock
  end: Date | null;
  timed: boolean; // has a meaningful time of day
};

type User = { id: string; tenantId: string; role: string };

const SUBJECT_HREF: Record<string, (id: string) => string> = {
  company: (id) => `/crm/companies/${id}`,
  contact: (id) => `/crm/contacts/${id}`,
  deal: (id) => `/crm/deals/${id}`,
  lead: () => `/crm/leads`,
};

export function allowedKinds(role: string): CalendarKind[] {
  const kinds: CalendarKind[] = ["tasks", "activities"];
  if (can(role, "event", "view")) kinds.push("events");
  if (can(role, "marketing", "view")) kinds.push("marketing");
  if (can(role, "ambassador", "view")) kinds.push("content");
  if (can(role, "ambassador", "view") || can(role, "partner", "view")) kinds.push("deadlines");
  return CALENDAR_KINDS.map((k) => k.value).filter((k) => kinds.includes(k));
}

export async function loadCalendarEntries(
  user: User,
  from: Date,
  to: Date,
  { kinds, mine = false }: { kinds: CalendarKind[]; mine?: boolean },
): Promise<CalendarEntry[]> {
  const t = user.tenantId;
  const want = new Set(kinds.filter((k) => allowedKinds(user.role).includes(k)));
  const today = toPragueWallClock(new Date());
  today.setHours(0, 0, 0, 0);
  const showAmb = can(user.role, "ambassador", "view");
  const showPartners = can(user.role, "partner", "view");
  // Same visibility as the Úkoly / Aktivity lists, so the calendar never shows more (or less).
  const [taskScope, activityScope] = await Promise.all([ownerScopeWhere(user, "task", "assigneeId"), ownerScopeWhere(user, "activity")]);

  const [tasks, activities, events, posts, content, deadlines] = await Promise.all([
    want.has("tasks")
      ? prisma.task.findMany({
          where: { ...taskScope, dueDate: { gte: from, lt: to }, status: { not: "cancelled" }, ...(mine ? { assigneeId: user.id } : {}) },
          select: { id: true, title: true, dueDate: true, status: true, assignee: { select: { name: true } } },
        })
      : [],
    want.has("activities")
      ? prisma.activity.findMany({
          where: { ...activityScope, activityAt: { gte: from, lt: to }, type: { not: "note" }, ...(mine ? { ownerId: user.id } : {}) },
          select: { id: true, subject: true, activityAt: true, subjectType: true, subjectId: true, owner: { select: { name: true } } },
        })
      : [],
    want.has("events")
      ? prisma.event.findMany({
          // Multi-day events that started earlier but still run into the range count too.
          where: { tenantId: t, status: { not: "cancelled" }, startDate: { lt: to }, OR: [{ endDate: { gte: from } }, { endDate: null, startDate: { gte: from } }] },
          select: { id: true, name: true, startDate: true, endDate: true },
        })
      : [],
    want.has("marketing")
      ? prisma.marketingPost.findMany({
          where: {
            tenantId: t,
            status: { not: "cancelled" },
            OR: [{ status: "published", publishedAt: { gte: from, lt: to } }, { status: { not: "published" }, scheduledAt: { gte: from, lt: to } }],
            ...(mine ? { ownerId: user.id } : {}),
          },
          select: { id: true, title: true, status: true, channel: true, scheduledAt: true, publishedAt: true, owner: { select: { name: true } } },
        })
      : [],
    want.has("content") && !mine
      ? prisma.partnershipFulfillment.findMany({
          where: { tenantId: t, status: "planned", date: { gte: from, lt: to }, term: { subjectType: "ambassador" } },
          select: { date: true, term: { select: { title: true, subjectId: true } } },
        })
      : [],
    // "Termín splnění" deadlines of ambassador / partner terms.
    want.has("deadlines") && !mine
      ? prisma.partnershipTerm.findMany({
          where: {
            tenantId: t,
            isActive: true,
            dueDate: { gte: from, lt: to },
            subjectType: { in: [...(showAmb ? ["ambassador"] : []), ...(showPartners ? ["partner"] : [])] },
          },
          select: { title: true, subjectType: true, subjectId: true, dueDate: true, _count: { select: { fulfillments: { where: { status: "done" } } } } },
        })
      : [],
  ]);

  const ambassadorIds = [...new Set([...content.map((c) => c.term.subjectId), ...deadlines.filter((d) => d.subjectType === "ambassador").map((d) => d.subjectId)])];
  const partnerIds = [...new Set(deadlines.filter((d) => d.subjectType === "partner").map((d) => d.subjectId))];
  const [ambassadors, partners] = await Promise.all([
    ambassadorIds.length ? prisma.ambassador.findMany({ where: { id: { in: ambassadorIds } }, select: { id: true, firstName: true, lastName: true } }) : [],
    partnerIds.length ? prisma.partner.findMany({ where: { id: { in: partnerIds } }, select: { id: true, name: true } }) : [],
  ]);
  const ambassadorName = new Map(ambassadors.map((a) => [a.id, `${a.firstName} ${a.lastName}`]));
  const partnerName = new Map(partners.map((p) => [p.id, p.name]));

  const out: CalendarEntry[] = [];
  const day = (d: Date) => toPragueWallClock(d);

  for (const e of events) {
    out.push({ kind: "events", start: day(e.startDate), end: e.endDate ? day(e.endDate) : null, timed: false, label: e.name, href: `/events/${e.id}`, tone: "brand" });
  }
  for (const tk of tasks) {
    const done = tk.status === "done";
    const late = !done && day(tk.dueDate!) < today;
    out.push({
      kind: "tasks", start: day(tk.dueDate!), end: null, timed: false,
      label: `${done ? "✓ " : late ? "⚠ " : ""}${tk.title}`,
      title: `Úkol: ${tk.title} (${tk.assignee.name})`,
      href: "/tasks",
      tone: late ? "rose" : done ? "emerald" : "sky",
    });
  }
  for (const a of activities) {
    out.push({
      kind: "activities", start: day(a.activityAt), end: null, timed: true,
      label: a.subject, title: `${a.subject} (${a.owner.name})`,
      href: a.subjectType && a.subjectId ? SUBJECT_HREF[a.subjectType]?.(a.subjectId) : "/crm/activities",
      tone: "violet",
    });
  }
  for (const p of posts) {
    const published = p.status === "published";
    const at = published ? p.publishedAt! : p.scheduledAt!;
    const notReady = !published && p.status !== "scheduled";
    const late = !published && day(at) < today;
    const ch = findMeta(MARKETING_CHANNELS, p.channel)?.label ?? p.channel;
    out.push({
      kind: "marketing", start: day(at), end: null, timed: true,
      label: `${published ? "✓ " : late ? "⚠ " : notReady ? "✎ " : ""}${ch} · ${p.title}`,
      title: `${ch}: ${p.title} (${p.owner.name})${notReady ? " – ještě není hotové" : ""}`,
      href: "/marketing/content",
      tone: late ? "rose" : published ? "emerald" : "indigo",
    });
  }
  for (const c of content) {
    const late = day(c.date) < today;
    out.push({
      kind: "content", start: day(c.date), end: null, timed: false,
      label: `${late ? "⚠ " : ""}${ambassadorName.get(c.term.subjectId) ?? ""} · ${c.term.title}`,
      href: `/crm/ambassadors/${c.term.subjectId}`,
      tone: late ? "rose" : "amber",
    });
  }
  for (const d of deadlines) {
    const isAmb = d.subjectType === "ambassador";
    const who = isAmb ? ambassadorName.get(d.subjectId) : partnerName.get(d.subjectId);
    const done = d._count.fulfillments > 0;
    const late = !done && day(d.dueDate!) < today;
    out.push({
      kind: "deadlines", start: day(d.dueDate!), end: null, timed: false,
      label: `${done ? "✓ " : late ? "⚠ " : "⏰ "}${who ?? ""} · ${d.title}`,
      title: `Termín splnění: ${who ?? ""} · ${d.title}`,
      href: `/crm/${isAmb ? "ambassadors" : "partners"}/${d.subjectId}`,
      tone: done ? "emerald" : late ? "rose" : "amber",
    });
  }

  // Untimed first (all-day), then by time.
  return out.sort((a, b) => Number(a.timed) - Number(b.timed) || a.start.getTime() - b.start.getTime());
}

export function parseKinds(f: string | undefined, role: string): CalendarKind[] {
  const allowed = allowedKinds(role);
  if (!f) return allowed;
  const picked = f.split(",").filter((k): k is CalendarKind => allowed.includes(k as CalendarKind));
  return picked.length ? picked : allowed;
}

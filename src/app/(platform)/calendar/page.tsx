import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { MonthCalendar, MonthNav, addToDays, monthRange, type CalendarItem } from "@/components/calendar/month-calendar";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const { y, m } = await searchParams;
  const session = await auth();
  const user = session!.user;

  const { year, month, start: rangeStart, end: rangeEnd } = monthRange(y, m);
  const today = new Date(new Date().toDateString());
  const showEvents = can(user.role, "event", "view");
  const showContent = can(user.role, "ambassador", "view");

  const [tasks, activities, events, content] = await Promise.all([
    prisma.task.findMany({
      where: { tenantId: user.tenantId, dueDate: { gte: rangeStart, lt: rangeEnd } },
      include: { assignee: { select: { name: true } } },
    }),
    prisma.activity.findMany({
      where: { tenantId: user.tenantId, activityAt: { gte: rangeStart, lt: rangeEnd } },
      include: { owner: { select: { name: true } } },
    }),
    showEvents
      ? prisma.event.findMany({
          // Multi-day events that started earlier but still run into this month count too.
          where: { tenantId: user.tenantId, startDate: { lt: rangeEnd }, OR: [{ endDate: { gte: rangeStart } }, { endDate: null, startDate: { gte: rangeStart } }] },
          select: { id: true, name: true, startDate: true, endDate: true, status: true },
        })
      : [],
    showContent
      ? prisma.partnershipFulfillment.findMany({
          where: { tenantId: user.tenantId, status: "planned", date: { gte: rangeStart, lt: rangeEnd }, term: { subjectType: "ambassador" } },
          include: { term: { select: { title: true, subjectId: true } } },
        })
      : [],
  ]);

  const ambassadorIds = [...new Set(content.map((c) => c.term.subjectId))];
  const ambassadors = ambassadorIds.length
    ? await prisma.ambassador.findMany({ where: { id: { in: ambassadorIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const ambassadorName = new Map(ambassadors.map((a) => [a.id, `${a.firstName} ${a.lastName}`]));

  const byDay = new Map<number, CalendarItem[]>();
  for (const e of events) {
    if (e.status === "cancelled") continue;
    addToDays(byDay, year, month, e.startDate, e.endDate, { label: e.name, href: `/events/${e.id}`, tone: "brand" });
  }
  for (const t of tasks) {
    if (!t.dueDate) continue;
    addToDays(byDay, year, month, t.dueDate, null, { label: t.title, tone: "sky", title: `Úkol: ${t.title} (${t.assignee.name})` });
  }
  for (const a of activities) {
    addToDays(byDay, year, month, a.activityAt, null, { label: a.subject, tone: "violet" });
  }
  for (const c of content) {
    const late = c.date < today;
    addToDays(byDay, year, month, c.date, null, {
      label: `${late ? "⚠ " : ""}${ambassadorName.get(c.term.subjectId) ?? ""} · ${c.term.title}`,
      href: `/crm/ambassadors/${c.term.subjectId}`,
      tone: late ? "rose" : "amber",
    });
  }

  return (
    <div>
      <PageHeader
        title="Kalendář"
        description={rangeStart.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" })}
        breadcrumbs={[{ label: "Kalendář" }]}
        actions={<MonthNav basePath="/calendar" year={year} month={month} />}
      />
      <div className="p-6">
        <MonthCalendar year={year} month={month} byDay={byDay} />
        <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {showEvents && <span className="flex items-center gap-1.5"><StatusBadge label="Akce" color="indigo" /> kempy, testování, workshopy</span>}
          <span className="flex items-center gap-1.5"><StatusBadge label="Úkoly" color="sky" /> termíny úkolů</span>
          <span className="flex items-center gap-1.5"><StatusBadge label="Aktivity" color="violet" /> naplánované schůzky a hovory</span>
          {showContent && <span className="flex items-center gap-1.5"><StatusBadge label="Obsah" color="amber" /> naplánované reely a posty ambasadorů</span>}
        </div>
      </div>
    </div>
  );
}

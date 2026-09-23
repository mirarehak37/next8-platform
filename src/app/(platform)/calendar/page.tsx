import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TASK_PRIORITIES, ACTIVITY_TYPES, findMeta } from "@/lib/constants";

function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const { y, m } = await searchParams;
  const session = await auth();
  const user = session!.user;

  const now = new Date();
  const year = y ? Number(y) : now.getFullYear();
  const month = m ? Number(m) - 1 : now.getMonth();

  const rangeStart = new Date(year, month, 1);
  const rangeEnd = new Date(year, month + 1, 1);

  const [tasks, activities] = await Promise.all([
    prisma.task.findMany({
      where: { tenantId: user.tenantId, dueDate: { gte: rangeStart, lt: rangeEnd } },
      include: { assignee: { select: { name: true } } },
    }),
    prisma.activity.findMany({
      where: { tenantId: user.tenantId, activityAt: { gte: rangeStart, lt: rangeEnd } },
      include: { owner: { select: { name: true } } },
    }),
  ]);

  const byDay = new Map<number, { type: "task" | "activity"; label: string; href?: string; meta?: string }[]>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const day = t.dueDate.getDate();
    if (!byDay.has(day)) byDay.set(day, []);
    const prio = findMeta(TASK_PRIORITIES, t.priority);
    byDay.get(day)!.push({ type: "task", label: t.title, meta: prio?.label });
  }
  for (const a of activities) {
    const day = a.activityAt.getDate();
    if (!byDay.has(day)) byDay.set(day, []);
    const meta = findMeta(ACTIVITY_TYPES, a.type);
    byDay.get(day)!.push({ type: "activity", label: a.subject, meta: meta?.label });
  }

  const cells = monthGrid(year, month);
  const monthLabel = rangeStart.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });
  const prevMonth = month === 0 ? { y: year - 1, m: 12 } : { y: year, m: month };
  const nextMonth = month === 11 ? { y: year + 1, m: 1 } : { y: year, m: month + 2 };
  const todayKey = now.getFullYear() === year && now.getMonth() === month ? now.getDate() : -1;

  return (
    <div>
      <PageHeader
        title="Kalendář"
        description={monthLabel}
        breadcrumbs={[{ label: "Kalendář" }]}
        actions={
          <div className="flex gap-2">
            <Link href={`/calendar?y=${prevMonth.y}&m=${prevMonth.m}`} className="text-sm px-3 py-1.5 rounded-md border hover:bg-muted">‹ Předchozí</Link>
            <Link href={`/calendar?y=${now.getFullYear()}&m=${now.getMonth() + 1}`} className="text-sm px-3 py-1.5 rounded-md border hover:bg-muted">Dnes</Link>
            <Link href={`/calendar?y=${nextMonth.y}&m=${nextMonth.m}`} className="text-sm px-3 py-1.5 rounded-md border hover:bg-muted">Další ›</Link>
          </div>
        }
      />
      <div className="p-6">
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
          {["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].map((d) => (
            <div key={d} className="bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground text-center">{d}</div>
          ))}
          {cells.map((date, i) => (
            <div key={i} className={`bg-background min-h-[110px] p-1.5 ${!date ? "bg-muted/30" : ""}`}>
              {date && (
                <>
                  <div className={`text-xs mb-1 h-5 w-5 flex items-center justify-center rounded-full ${date.getDate() === todayKey ? "bg-[#FF1947] text-white font-medium" : "text-muted-foreground"}`}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {(byDay.get(date.getDate()) ?? []).slice(0, 3).map((item, idx) => (
                      <div key={idx} className="text-[10px] leading-tight px-1 py-0.5 rounded bg-muted truncate" title={item.label}>
                        {item.label}
                      </div>
                    ))}
                    {(byDay.get(date.getDate())?.length ?? 0) > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">+{(byDay.get(date.getDate())?.length ?? 0) - 3} další</div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><StatusBadge label="Úkoly" color="sky" /> termíny úkolů</span>
          <span className="flex items-center gap-1.5"><StatusBadge label="Aktivity" color="violet" /> naplánované schůzky a hovory</span>
        </div>
      </div>
    </div>
  );
}

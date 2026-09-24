import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MonthCalendar, MonthNav, addToDays, monthRange, type CalendarItem } from "@/components/calendar/month-calendar";
import { termProgress } from "@/lib/partnerships";
import { TERM_PERIODS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { CalendarClock, AlertTriangle, CheckCircle2, Wallet } from "lucide-react";
import { PayoutList, type PayoutRow } from "./payout-list";

const PERIOD_NOW: Record<string, string> = { monthly: "tento měsíc", quarterly: "toto čtvrtletí", season: "tuto sezónu", yearly: "letos", one_off: "celkem" };

export default async function ContentPlanPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string; tab?: string }> }) {
  const { y, m, tab } = await searchParams;
  const session = await auth();
  const user = session!.user;
  if (!can(user.role, "ambassador", "view")) redirect("/dashboard");

  const { year, month, start, end } = monthRange(y, m);
  const today = new Date(new Date().toDateString());

  // Every obligation (what ambassadors must deliver) of ambassadors that aren't ended.
  const ambassadors = await prisma.ambassador.findMany({
    where: { tenantId: user.tenantId, status: { notIn: ["ended"] } },
    select: { id: true, firstName: true, lastName: true, bankAccount: true, registrationNumber: true, billingType: true },
  });
  const byId = new Map(ambassadors.map((a) => [a.id, a]));
  const terms = await prisma.partnershipTerm.findMany({
    where: { tenantId: user.tenantId, subjectType: "ambassador", direction: "they_give", subjectId: { in: [...byId.keys()] } },
    include: { fulfillments: { orderBy: { date: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  const name = (id: string) => {
    const a = byId.get(id);
    return a ? `${a.firstName} ${a.lastName}` : "—";
  };

  // --- Calendar: planned (grey / red when late) and delivered (green) content.
  const calendar = new Map<number, CalendarItem[]>();
  for (const t of terms) {
    for (const f of t.fulfillments) {
      if (f.date < start || f.date >= end) continue;
      const planned = f.status === "planned";
      const late = planned && f.date < today;
      addToDays(calendar, year, month, f.date, null, {
        label: `${planned ? (late ? "⚠ " : "") : "✓ "}${name(t.subjectId)} · ${t.title}`,
        href: `/crm/ambassadors/${t.subjectId}`,
        tone: late ? "rose" : planned ? "default" : "emerald",
      });
    }
  }

  // --- Obligations overview
  const rows = terms
    .filter((t) => t.isActive)
    .map((t) => {
      const done = t.fulfillments.filter((f) => f.status === "done");
      const planned = t.fulfillments.filter((f) => f.status === "planned");
      const late = planned.filter((f) => f.date < today);
      const next = planned.find((f) => f.date >= today);
      const progress = termProgress({ ...t, fulfillments: done }, done);
      const pastDue = !!t.dueDate && t.dueDate < today && progress.ratio !== null && progress.ratio < 1;
      const state = late.length || pastDue ? "late" : progress.ratio === 1 ? "done" : "running";
      return { t, progress, late: late.length, next, state };
    })
    .sort((a, b) => (a.state === "late" ? 0 : a.state === "running" ? 1 : 2) - (b.state === "late" ? 0 : b.state === "running" ? 1 : 2));

  // --- Unpaid rewards (for accounting)
  const payouts: PayoutRow[] = terms.flatMap((t) =>
    t.fulfillments
      .filter((f) => f.status === "done" && f.rewardAmount && !f.paidAt)
      .map((f) => {
        const a = byId.get(t.subjectId);
        return {
          id: f.id,
          date: f.date.toISOString(),
          ambassadorId: t.subjectId,
          ambassador: name(t.subjectId),
          term: t.title,
          metricValue: f.metricValue,
          metric: t.bonusMetric || "zhlédnutí",
          amount: f.rewardAmount!,
          link: f.link,
          bankAccount: a?.bankAccount ?? null,
          registrationNumber: a?.registrationNumber ?? null,
        };
      }),
  );

  const plannedThisMonth = terms.flatMap((t) => t.fulfillments).filter((f) => f.status === "planned" && f.date >= start && f.date < end).length;
  const lateCount = rows.reduce((s, r) => s + r.late, 0) + rows.filter((r) => r.state === "late" && r.late === 0).length;
  const doneThisMonth = terms.flatMap((t) => t.fulfillments).filter((f) => f.status === "done" && f.date >= start && f.date < end).length;
  const toPay = payouts.reduce((s, p) => s + p.amount, 0);
  const periodLabel = (p: string) => TERM_PERIODS.find((x) => x.value === p)?.label ?? p;

  return (
    <div>
      <PageHeader
        title="Obsahový plán ambasadorů"
        description={start.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" })}
        breadcrumbs={[{ label: "Partnerství" }, { label: "Ambasadoři", href: "/crm/ambassadors" }, { label: "Obsahový plán" }]}
        actions={<MonthNav basePath="/crm/ambassadors/content" year={year} month={month} extraQuery={tab ? `tab=${tab}` : ""} />}
      />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Naplánováno v měsíci" value={String(plannedThisMonth)} icon={CalendarClock} />
          <KpiCard label="Splněno v měsíci" value={String(doneThisMonth)} icon={CheckCircle2} />
          <KpiCard label="Zpožděné povinnosti" value={String(lateCount)} hint="po termínu a nesplněné" icon={AlertTriangle} />
          <KpiCard label="K výplatě" value={formatCurrency(toPay)} hint={`${payouts.length} odměn`} icon={Wallet} />
        </div>

        <Tabs defaultValue={tab ?? "calendar"}>
          <TabsList variant="line">
            <TabsTrigger value="calendar">Kalendář</TabsTrigger>
            <TabsTrigger value="obligations">Povinnosti ({rows.length})</TabsTrigger>
            <TabsTrigger value="payouts">K výplatě ({payouts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="pt-4 space-y-3">
            <MonthCalendar year={year} month={month} byDay={calendar} maxPerDay={4} />
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><StatusBadge label="Naplánováno" color="slate" /></span>
              <span className="flex items-center gap-1.5"><StatusBadge label="✓ Splněno" color="emerald" /></span>
              <span className="flex items-center gap-1.5"><StatusBadge label="⚠ Zpožděno" color="rose" /></span>
              <span>Termíny se plánují u ambasadora → Co musí udělat → Naplánovat.</span>
            </div>
          </TabsContent>

          <TabsContent value="obligations" className="pt-4 space-y-2">
            {rows.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground border rounded-md border-dashed">Žádné aktivní povinnosti ambasadorů.</div>
            )}
            {rows.map(({ t, progress, late, next, state }) => (
              <Card key={t.id}>
                <CardContent className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-[180px] flex-1">
                    <Link href={`/crm/ambassadors/${t.subjectId}`} className="text-sm font-medium hover:underline">{name(t.subjectId)}</Link>
                    <div className="text-xs text-muted-foreground">{t.title} · {periodLabel(t.period)}</div>
                  </div>
                  <div className="text-xs min-w-[140px]">
                    {progress.target ? (
                      <>
                        <div className="flex justify-between gap-2"><span className="text-muted-foreground">{PERIOD_NOW[t.period] ?? ""}</span><span className="font-medium">{progress.done} / {progress.target}</span></div>
                        <div className="h-1.5 mt-1 rounded-full bg-muted overflow-hidden">
                          <div className={progress.ratio === 1 ? "h-full bg-emerald-500" : "h-full bg-[#FF1947]"} style={{ width: `${Math.round((progress.ratio ?? 0) * 100)}%` }} />
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">bez počtu</span>
                    )}
                  </div>
                  <div className="text-xs min-w-[130px]">
                    <div className="text-muted-foreground">Další termín</div>
                    <div className="font-medium">{next ? formatDate(next.date) : "nenaplánováno"}</div>
                  </div>
                  <div className="shrink-0">
                    {state === "late" ? (
                      <StatusBadge label={late ? `Zpožděno (${late}×)` : "Po termínu"} color="rose" />
                    ) : state === "done" ? (
                      <StatusBadge label="Splněno" color="emerald" />
                    ) : (
                      <StatusBadge label="Probíhá" color="sky" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="payouts" className="pt-4">
            <PayoutList rows={payouts} canEdit={can(user.role, "ambassador", "edit")} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

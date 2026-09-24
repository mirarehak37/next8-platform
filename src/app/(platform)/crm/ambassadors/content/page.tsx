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

function daysLabel(date: Date, today: Date) {
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  return days <= 0 ? "dnes" : days === 1 ? "zítra" : `za ${days} dní`;
}

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
  const allTerms = await prisma.partnershipTerm.findMany({
    where: { tenantId: user.tenantId, subjectType: "ambassador", subjectId: { in: [...byId.keys()] } },
    include: { fulfillments: { orderBy: { date: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  // Obligations = what ambassadors must deliver; our side only contributes deadlines.
  const terms = allTerms.filter((t) => t.direction === "they_give");
  const name = (id: string) => {
    const a = byId.get(id);
    return a ? `${a.firstName} ${a.lastName}` : "—";
  };

  // --- Agenda: every dated item — planned content, deliveries and the terms'
  // own "Termín splnění" deadlines (people often set only those).
  type AgendaItem = {
    date: Date;
    ambassadorId: string;
    title: string;
    kind: "planned" | "done" | "deadline" | "our_deadline";
    state: "late" | "upcoming" | "done";
    note: string | null;
  };
  const agenda: AgendaItem[] = [];
  for (const t of allTerms) {
    const done = t.fulfillments.filter((f) => f.status === "done");
    if (t.direction === "they_give") {
      for (const f of t.fulfillments) {
        const planned = f.status === "planned";
        agenda.push({
          date: f.date, ambassadorId: t.subjectId, title: t.title, kind: planned ? "planned" : "done",
          state: planned ? (f.date < today ? "late" : "upcoming") : "done", note: f.note,
        });
      }
    }
    if (t.dueDate && t.isActive) {
      // A deadline is met once the term's quota is reached (or anything was delivered, if it has no count).
      const progress = termProgress({ ...t, fulfillments: done }, done);
      const met = progress.ratio !== null ? progress.ratio >= 1 : done.length > 0;
      agenda.push({
        date: t.dueDate, ambassadorId: t.subjectId, title: t.title,
        kind: t.direction === "they_give" ? "deadline" : "our_deadline",
        state: met ? "done" : t.dueDate < today ? "late" : "upcoming", note: t.description,
      });
    }
  }
  agenda.sort((a, b) => a.date.getTime() - b.date.getTime());

  const KIND_PREFIX: Record<AgendaItem["kind"], string> = { planned: "", done: "✓ ", deadline: "⏰ ", our_deadline: "💳 " };
  const calendar = new Map<number, CalendarItem[]>();
  for (const it of agenda) {
    if (it.date < start || it.date >= end) continue;
    addToDays(calendar, year, month, it.date, null, {
      label: `${it.state === "late" ? "⚠ " : KIND_PREFIX[it.kind]}${name(it.ambassadorId)} · ${it.title}`,
      title: `${name(it.ambassadorId)} · ${it.title}${it.kind === "deadline" ? " (termín splnění)" : it.kind === "our_deadline" ? " (náš termín)" : ""}${it.note ? ` — ${it.note}` : ""}`,
      href: `/crm/ambassadors/${it.ambassadorId}`,
      tone: it.state === "late" ? "rose" : it.state === "done" ? "emerald" : it.kind === "planned" ? "default" : "amber",
    });
  }
  // Below the grid: everything overdue plus the next 60 days, as a readable list.
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 60);
  const upcoming = agenda.filter((it) => it.state === "late" || (it.state === "upcoming" && it.date <= horizon));
  const KIND_LABEL: Record<AgendaItem["kind"], string> = { planned: "Naplánováno", done: "Splněno", deadline: "Termín splnění", our_deadline: "Náš termín" };

  // --- Obligations overview
  const rows = terms
    .filter((t) => t.isActive)
    .map((t) => {
      const done = t.fulfillments.filter((f) => f.status === "done");
      const planned = t.fulfillments.filter((f) => f.status === "planned");
      const late = planned.filter((f) => f.date < today);
      const nextPlanned = planned.find((f) => f.date >= today)?.date;
      const nextDeadline = t.dueDate && t.dueDate >= today ? t.dueDate : undefined;
      const next = [nextPlanned, nextDeadline].filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0];
      const progress = termProgress({ ...t, fulfillments: done }, done);
      const pastDue = !!t.dueDate && t.dueDate < today && progress.ratio !== null && progress.ratio < 1;
      const state = late.length || pastDue ? "late" : progress.ratio === 1 ? "done" : "running";
      return { t, progress, late: late.length, next, state };
    })
    .sort((a, b) => (a.state === "late" ? 0 : a.state === "running" ? 1 : 2) - (b.state === "late" ? 0 : b.state === "running" ? 1 : 2));

  // --- Unpaid rewards (for accounting)
  // Rewards for deliveries and commissions booked from won deals alike.
  const payouts: PayoutRow[] = allTerms.flatMap((t) =>
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
          metric: t.direction === "we_give" ? "provize" : t.bonusMetric || "zhlédnutí",
          amount: f.rewardAmount!,
          link: f.link,
          note: f.note,
          bankAccount: a?.bankAccount ?? null,
          registrationNumber: a?.registrationNumber ?? null,
        };
      }),
  );

  const plannedThisMonth = agenda.filter((it) => it.kind !== "done" && it.date >= start && it.date < end).length;
  const lateCount = agenda.filter((it) => it.state === "late").length;
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
          <KpiCard label="Termíny v měsíci" value={String(plannedThisMonth)} icon={CalendarClock} />
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
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <StatusBadge label="Naplánováno" color="slate" />
              <StatusBadge label="⏰ Termín splnění" color="amber" />
              <StatusBadge label="💳 Náš termín" color="amber" />
              <StatusBadge label="✓ Splněno" color="emerald" />
              <StatusBadge label="⚠ Zpožděno" color="rose" />
            </div>

            <div className="space-y-2 pt-2">
              <h2 className="text-sm font-semibold">Co je potřeba udělat (zpožděné + dalších 60 dní)</h2>
              {upcoming.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground border rounded-md border-dashed">
                  Nic naplánovaného. U ambasadora zadej u povinnosti „Termín splnění“ nebo klikni na „Naplánovat“.
                </div>
              )}
              {upcoming.map((it, i) => (
                <Card key={i}>
                  <CardContent className="py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div className={`w-24 shrink-0 text-sm font-semibold ${it.state === "late" ? "text-rose-600" : ""}`}>{formatDate(it.date)}</div>
                    <div className="min-w-[160px] flex-1">
                      <Link href={`/crm/ambassadors/${it.ambassadorId}`} className="text-sm font-medium hover:underline">{name(it.ambassadorId)}</Link>
                      <div className="text-xs text-muted-foreground">{it.title}{it.note ? ` — ${it.note}` : ""}</div>
                    </div>
                    <StatusBadge label={KIND_LABEL[it.kind]} color={it.kind === "planned" ? "slate" : "amber"} />
                    {it.state === "late" ? <StatusBadge label="Zpožděno" color="rose" /> : <StatusBadge label={daysLabel(it.date, today)} color="sky" />}
                  </CardContent>
                </Card>
              ))}
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
                    <div className="font-medium">{next ? formatDate(next) : "nenaplánováno"}</div>
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

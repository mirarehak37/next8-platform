import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ownerScopeWhere } from "@/lib/scope";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PipelineFunnelChart, TrendChart, LeadSourceChart } from "@/components/dashboard/charts";
import { MyTasksWidget, ActivityFeedWidget, TopPerformersWidget, StaleDealsWidget } from "@/components/dashboard/list-widgets";
import { WeekAgenda } from "@/components/dashboard/week-agenda";
import { allowedKinds, loadCalendarEntries } from "@/lib/calendar-items";
import { toPragueWallClock } from "@/lib/marketing";
import { APP_TZ, formatCurrencyCompact, todayDateOnly } from "@/lib/format";
import {
  Wallet, TrendingUp, UserPlus, Handshake, Trophy, Percent, Target, Clock,
} from "lucide-react";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function DashboardPage() {
  const session = await auth();
  const user = session!.user;

  const [dealScope, leadScope, activityScope, taskScope] = await Promise.all([
    ownerScopeWhere(user, "deal"),
    ownerScopeWhere(user, "lead"),
    ownerScopeWhere(user, "activity"),
    ownerScopeWhere(user, "task", "assigneeId"),
  ]);

  const now = new Date();

  const [
    openDeals,
    pipelineStages,
    newLeads30,
    newDeals30,
    wonDeals90,
    lostDeals90Count,
    totalLeads90,
    convertedLeads90,
    myTasksToday,
    recentActivitiesRaw,
    leadSourceGroups,
    upcomingMeetings,
    activityMaxByDeal,
  ] = await Promise.all([
    prisma.deal.findMany({
      where: { ...dealScope, status: "open" },
      include: { stage: true, company: { select: { name: true } } },
    }),
    prisma.pipelineStage.findMany({
      where: { isWon: false, isLost: false, pipeline: { tenantId: user.tenantId, isDefault: true } },
      orderBy: { order: "asc" },
    }),
    prisma.lead.count({ where: { ...leadScope, createdAt: { gte: daysAgo(30) } } }),
    prisma.deal.count({ where: { ...dealScope, createdAt: { gte: daysAgo(30) } } }),
    prisma.deal.findMany({ where: { ...dealScope, status: "won", closedAt: { gte: daysAgo(90) } }, select: { value: true, createdAt: true, closedAt: true, ownerId: true } }),
    prisma.deal.count({ where: { ...dealScope, status: "lost", closedAt: { gte: daysAgo(90) } } }),
    prisma.lead.count({ where: { ...leadScope, createdAt: { gte: daysAgo(90) } } }),
    prisma.lead.count({ where: { ...leadScope, status: "converted", createdAt: { gte: daysAgo(90) } } }),
    prisma.task.findMany({
      // Today's plus anything overdue — overdue work shouldn't disappear from "my tasks".
      where: { tenantId: user.tenantId, assigneeId: user.id, status: { in: ["open", "in_progress"] }, dueDate: { lt: new Date(todayDateOnly().getTime() + 86400000) } },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    prisma.activity.findMany({ where: activityScope, orderBy: { activityAt: "desc" }, take: 8, include: { owner: { select: { name: true } } } }),
    prisma.lead.groupBy({ by: ["source"], where: leadScope, _count: { _all: true } }),
    prisma.activity.findMany({
      where: { ...activityScope, type: "meeting", activityAt: { gte: now } },
      orderBy: { activityAt: "asc" },
      take: 5,
    }),
    prisma.activity.groupBy({ by: ["subjectId"], where: { tenantId: user.tenantId, subjectType: "deal" }, _max: { activityAt: true } }),
  ]);

  const agendaToday = toPragueWallClock(now);
  agendaToday.setHours(0, 0, 0, 0);
  const agenda = await loadCalendarEntries(user, new Date(now.getTime() - 2 * 86400000), new Date(now.getTime() + 8 * 86400000), {
    kinds: allowedKinds(user.role),
  });

  const openValue = openDeals.reduce((s, d) => s + d.value, 0);
  const expectedRevenue = openDeals.reduce((s, d) => s + (d.value * (d.probability ?? d.stage.probability)) / 100, 0);
  const wonCount90 = wonDeals90.length;
  const winRate = wonCount90 + lostDeals90Count > 0 ? Math.round((wonCount90 / (wonCount90 + lostDeals90Count)) * 100) : 0;
  const avgDealValue = wonCount90 > 0 ? wonDeals90.reduce((s, d) => s + d.value, 0) / wonCount90 : 0;
  const avgCycleDays =
    wonCount90 > 0
      ? Math.round(
          wonDeals90.reduce((s, d) => s + (d.closedAt!.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60 * 24), 0) / wonCount90,
        )
      : 0;
  const conversionRate = totalLeads90 > 0 ? Math.round((convertedLeads90 / totalLeads90) * 100) : 0;

  const pipelineData = pipelineStages.map((stage) => {
    const deals = openDeals.filter((d) => d.stageId === stage.id);
    return { stage: stage.name, value: deals.reduce((s, d) => s + d.value, 0), count: deals.length };
  });

  const activityMaxMap = new Map(activityMaxByDeal.map((a) => [a.subjectId, a._max.activityAt]));
  const staleDeals = openDeals
    .map((d) => {
      const last = activityMaxMap.get(d.id) ?? d.createdAt;
      const daysSince = Math.floor((now.getTime() - new Date(last).getTime()) / (1000 * 60 * 60 * 24));
      return { id: d.id, name: d.name, value: d.value, companyName: d.company?.name ?? null, daysSinceActivity: daysSince };
    })
    .filter((d) => d.daysSinceActivity >= 14)
    .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity)
    .slice(0, 6);

  // Trend chart — last 6 months, won (by close date) vs. currently-open (by create date)
  const trendData = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const [wonAgg, openAgg] = await Promise.all([
      prisma.deal.aggregate({ where: { ...dealScope, status: "won", closedAt: { gte: monthStart, lt: monthEnd } }, _sum: { value: true } }),
      prisma.deal.aggregate({ where: { ...dealScope, createdAt: { gte: monthStart, lt: monthEnd } }, _sum: { value: true } }),
    ]);
    trendData.push({
      month: monthStart.toLocaleDateString("cs-CZ", { month: "short" }),
      won: wonAgg._sum.value ?? 0,
      lost: 0,
      open: openAgg._sum.value ?? 0,
    });
  }

  // Top performers — only meaningful beyond "own" scope
  let topPerformers: { name: string; wonValue: number; wonCount: number }[] = [];
  if (wonDeals90.length > 0) {
    const byOwner = new Map<string, { wonValue: number; wonCount: number }>();
    for (const d of wonDeals90) {
      const entry = byOwner.get(d.ownerId) ?? { wonValue: 0, wonCount: 0 };
      entry.wonValue += d.value;
      entry.wonCount += 1;
      byOwner.set(d.ownerId, entry);
    }
    const owners = await prisma.user.findMany({ where: { id: { in: Array.from(byOwner.keys()) } }, select: { id: true, name: true } });
    topPerformers = owners
      .map((o) => ({ name: o.name, ...byOwner.get(o.id)! }))
      .sort((a, b) => b.wonValue - a.wonValue)
      .slice(0, 5);
  }

  const leadSourceData = leadSourceGroups.map((g) => ({ source: g.source ?? "Neuvedeno", count: g._count._all }));

  return (
    <div>
      <PageHeader title="Dashboard" description={`Vítejte zpět, ${user.name?.split(" ")[0]}. Zde je přehled vašeho obchodu.`} />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Hodnota otevřených obchodů" value={formatCurrencyCompact(openValue)} icon={Wallet} hint={`${openDeals.length} obchodů`} />
          <KpiCard label="Očekávané tržby (forecast)" value={formatCurrencyCompact(expectedRevenue)} icon={TrendingUp} />
          <KpiCard label="Nové leady (30 dní)" value={String(newLeads30)} icon={UserPlus} />
          <KpiCard label="Nové obchody (30 dní)" value={String(newDeals30)} icon={Handshake} />
          <KpiCard label="Úspěšnost obchodu" value={`${winRate}%`} icon={Trophy} hint={`${wonCount90} vyhráno / ${lostDeals90Count} prohráno (90 dní)`} />
          <KpiCard label="Konverzní poměr leadů" value={`${conversionRate}%`} icon={Percent} hint="posledních 90 dní" />
          <KpiCard label="Průměrná hodnota obchodu" value={formatCurrencyCompact(avgDealValue)} icon={Target} />
          <KpiCard label="Průměrná délka cyklu" value={`${avgCycleDays} dní`} icon={Clock} />
        </div>

        <WeekAgenda entries={agenda} today={agendaToday} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <TrendChart data={trendData} />
          </div>
          <LeadSourceChart data={leadSourceData} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <PipelineFunnelChart data={pipelineData} />
          <MyTasksWidget tasks={myTasksToday} />
          <StaleDealsWidget deals={staleDeals} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ActivityFeedWidget
            activities={recentActivitiesRaw.map((a) => ({ id: a.id, type: a.type, subject: a.subject, ownerName: a.owner.name, activityAt: a.activityAt }))}
          />
          <TopPerformersWidget performers={topPerformers} />
          <div className="rounded-lg border bg-background p-4">
            <h3 className="text-base font-semibold mb-1">Naplánované schůzky</h3>
            <p className="text-sm text-muted-foreground mb-3">Nejbližší nadcházející aktivity</p>
            <div className="space-y-2">
              {upcomingMeetings.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Žádné naplánované schůzky.</p>}
              {upcomingMeetings.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{m.subject}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    {new Date(m.activityAt).toLocaleDateString("cs-CZ", { timeZone: APP_TZ, day: "numeric", month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

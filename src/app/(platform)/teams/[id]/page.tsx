import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { ownerScopeWhere } from "@/lib/scope";
import { formatCurrencyCompact } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { StatCard, StatGrid, Panel } from "@/components/common/stat-card";
import { SegmentBar } from "@/components/common/segment-bar";
import { OwnerBadge } from "@/components/common/owner-badge";
import { Tag } from "@/components/common/tag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DAY = 1000 * 60 * 60 * 24;

function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY);
}

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = session!.user;
  if (!can(user.role, "report", "view")) redirect("/dashboard");

  const team = await prisma.team.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, jobTitle: true, status: true } } },
        orderBy: { user: { name: "asc" } },
      },
    },
  });
  if (!team) notFound();

  const memberIds = team.members.map((m) => m.userId);
  const [dealScope, activityScope] = await Promise.all([ownerScopeWhere(user, "deal"), ownerScopeWhere(user, "activity")]);
  const since90 = daysAgo(90);
  const since30 = daysAgo(30);

  const [deals, activities] = await Promise.all([
    prisma.deal.findMany({
      where: {
        AND: [
          dealScope,
          { ownerId: { in: memberIds } },
          { OR: [{ status: "open" }, { closedAt: { gte: since90 } }] },
        ],
      },
      select: { ownerId: true, value: true, status: true, probability: true, stage: { select: { probability: true } } },
    }),
    prisma.activity.groupBy({
      by: ["ownerId"],
      where: { AND: [activityScope, { ownerId: { in: memberIds } }, { activityAt: { gte: since30 } }] },
      _count: { _all: true },
    }),
  ]);

  const activityByOwner = new Map(activities.map((a) => [a.ownerId, a._count._all]));
  const members = team.members.map((m) => {
    const own = deals.filter((d) => d.ownerId === m.userId);
    const open = own.filter((d) => d.status === "open");
    const won = own.filter((d) => d.status === "won");
    const lost = own.filter((d) => d.status === "lost");
    return {
      id: m.userId,
      name: m.user.name,
      jobTitle: m.user.jobTitle,
      isLead: m.roleInTeam === "lead",
      openDeals: open.length,
      pipeline: open.reduce((s, d) => s + d.value, 0),
      weighted: open.reduce((s, d) => s + (d.value * (d.probability ?? d.stage.probability)) / 100, 0),
      wonValue: won.reduce((s, d) => s + d.value, 0),
      winRate: won.length + lost.length > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : null,
      activities: activityByOwner.get(m.userId) ?? 0,
    };
  });

  const totals = {
    openDeals: members.reduce((s, m) => s + m.openDeals, 0),
    pipeline: members.reduce((s, m) => s + m.pipeline, 0),
    weighted: members.reduce((s, m) => s + m.weighted, 0),
    wonValue: members.reduce((s, m) => s + m.wonValue, 0),
    activities: members.reduce((s, m) => s + m.activities, 0),
  };
  const wonCount = deals.filter((d) => d.status === "won").length;
  const lostCount = deals.filter((d) => d.status === "lost").length;
  const teamWinRate = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0;

  return (
    <div>
      <PageHeader
        title={team.name}
        description={team.description ?? `Výkon týmu za posledních 90 dní · ${team.members.length} členů`}
        breadcrumbs={[{ label: "Týmy" }, { label: team.name }]}
      />

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <StatGrid>
          <StatCard label="Členové" value={team.members.length} hint={`${totals.activities} aktivit za 30 dní`} />
          <StatCard label="Otevřené obchody" value={totals.openDeals} />
          <StatCard
            label="Otevřená pipeline"
            value={formatCurrencyCompact(totals.pipeline)}
            hint={`${formatCurrencyCompact(totals.weighted)} váženě`}
          />
          <StatCard
            label="Vyhráno (90 dní)"
            value={formatCurrencyCompact(totals.wonValue)}
            hint={`Úspěšnost ${teamWinRate} % · ${wonCount} vyhráno / ${lostCount} prohráno`}
          />
        </StatGrid>

        <Panel className="overflow-hidden">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>Člen</TableHead>
                <TableHead>Pozice</TableHead>
                <TableHead className="text-right">Otevřené</TableHead>
                <TableHead className="text-right">Pipeline</TableHead>
                <TableHead className="text-right">Vyhráno (90 d)</TableHead>
                <TableHead className="text-right">Aktivity (30 d)</TableHead>
                <TableHead>Podíl na výhrách týmu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const share = totals.wonValue > 0 ? Math.round((m.wonValue / totals.wonValue) * 100) : 0;
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <OwnerBadge name={m.name} />
                        {m.isLead && (
                          <Tag tone="brand" size="sm">
                            Vedoucí
                          </Tag>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-soft">{m.jobTitle ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.openDeals}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyCompact(m.pipeline)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyCompact(m.wonValue)}
                      {m.winRate !== null && <span className="caption-style ml-1.5 text-subtle">{m.winRate} %</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.activities}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <SegmentBar percent={share} tone="brand" className="w-[96px]" />
                        <span className="w-[5ch] text-right tabular-nums">{share} %</span>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="caption-style h-[120px] text-center text-subtle">
                    Tým zatím nemá žádné členy. Přidejte je v Administraci → Týmy.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Panel>
      </div>
    </div>
  );
}

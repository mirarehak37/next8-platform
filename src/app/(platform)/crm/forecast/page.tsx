import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { ownerScopeWhere } from "@/lib/scope";
import { parseQuarterKey, quarterKey, quarterOf, quarterRange } from "@/lib/deal-insights";
import { formatCurrencyCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { FilterMenu } from "@/components/common/filter-menu";
import { StatCard, StatGrid, Panel } from "@/components/common/stat-card";
import { SegmentBar } from "@/components/common/segment-bar";
import { OwnerBadge } from "@/components/common/owner-badge";
import { Tag, stageTone } from "@/components/common/tag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const LEGEND = [
  { key: "closedWon", label: "Vyhráno", className: "bg-success" },
  { key: "commit", label: "Commit (≥ 75 %)", className: "bg-brand" },
  { key: "bestCase", label: "Best case (≥ 50 %)", className: "bg-[#7a68ff]" },
  { key: "pipeline", label: "Ostatní pipeline", className: "bg-track" },
] as const;

type ForecastDeal = {
  value: number;
  prob: number;
  status: string;
  date: Date;
};

function summarize(deals: ForecastDeal[]) {
  const sum = (list: ForecastDeal[]) => list.reduce((total, d) => total + d.value, 0);
  const won = deals.filter((d) => d.status === "won");
  const open = deals.filter((d) => d.status === "open");
  const commit = open.filter((d) => d.prob >= 75);
  const best = open.filter((d) => d.prob >= 50 && d.prob < 75);
  return {
    closedWon: sum(won),
    commit: sum(won) + sum(commit),
    bestCase: sum(won) + sum(commit) + sum(best),
    pipeline: sum(open),
    weighted: open.reduce((total, d) => total + (d.value * d.prob) / 100, 0),
    openCount: open.length,
  };
}

export default async function ForecastPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await auth();
  const user = session!.user;
  if (!can(user.role, "deal", "view")) redirect("/dashboard");

  const { q } = await searchParams;
  const now = quarterOf(new Date());
  const options = [-1, 0, 1, 2].map((offset) => {
    const index = now.year * 4 + (now.quarter - 1) + offset;
    const year = Math.floor(index / 4);
    const quarter = (index % 4) + 1;
    return { value: quarterKey(year, quarter), label: `Q${quarter} ${year}`, year, quarter };
  });
  const current = options[1];
  const ordered = [current, ...options.filter((o) => o !== current)];
  const selected = parseQuarterKey(q) ?? current;
  const selectedKey = quarterKey(selected.year, selected.quarter);
  const selectedLabel = `Q${selected.quarter} ${selected.year}`;
  const { start, end } = quarterRange(selected.year, selected.quarter);

  const scope = await ownerScopeWhere(user, "deal");
  const deals = await prisma.deal.findMany({
    where: {
      ...scope,
      OR: [
        { status: "open", expectedCloseDate: { gte: start, lt: end } },
        { status: "won", closedAt: { gte: start, lt: end } },
      ],
    },
    include: {
      stage: { select: { name: true, probability: true, isWon: true, isLost: true } },
      owner: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
    },
    orderBy: { value: "desc" },
  });

  const rows = deals.map((d) => ({
    ...d,
    prob: d.status === "won" ? 100 : d.probability ?? d.stage.probability,
    date: (d.status === "won" ? d.closedAt : d.expectedCloseDate) ?? start,
  }));

  const summary = summarize(rows);
  const wonShare = summary.closedWon + summary.pipeline > 0 ? Math.round((summary.closedWon / (summary.closedWon + summary.pipeline)) * 100) : 0;
  const commitShare = summary.bestCase > 0 ? Math.round((summary.commit / summary.bestCase) * 100) : 0;

  const months = [0, 1, 2].map((offset) => {
    const monthStart = new Date(start.getFullYear(), start.getMonth() + offset, 1);
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + offset + 1, 1);
    const inMonth = rows.filter((d) => d.date >= monthStart && d.date < monthEnd);
    return {
      key: monthStart.toISOString(),
      label: monthStart.toLocaleDateString("cs-CZ", { month: "long" }),
      ...summarize(inMonth),
    };
  });
  const peak = Math.max(1, ...months.map((m) => m.pipeline + m.closedWon));

  const ownerMap = new Map<string, { name: string; deals: typeof rows }>();
  for (const d of rows) {
    const entry = ownerMap.get(d.owner.id) ?? { name: d.owner.name, deals: [] };
    entry.deals.push(d);
    ownerMap.set(d.owner.id, entry);
  }
  const owners = Array.from(ownerMap.entries())
    .map(([id, o]) => ({ id, name: o.name, count: o.deals.length, ...summarize(o.deals) }))
    .sort((a, b) => b.bestCase - a.bestCase);

  const topOpen = rows.filter((d) => d.status === "open").slice(0, 8);

  return (
    <div>
      <PageHeader
        title="Forecast"
        description={`Obchody s očekávaným uzavřením v ${selectedLabel} · ${rows.length} obchodů`}
        breadcrumbs={[{ label: "CRM" }, { label: "Forecast" }]}
        actions={
          <FilterMenu
            label="Období"
            param="q"
            value={selectedKey}
            options={ordered.map(({ value, label }) => ({ value, label }))}
            align="end"
          />
        }
      />

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <StatGrid>
          <StatCard label="Commit" value={formatCurrencyCompact(summary.commit)} hint={`${commitShare} % z best case`} />
          <StatCard label="Best case" value={formatCurrencyCompact(summary.bestCase)} />
          <StatCard
            label="Otevřená pipeline"
            value={formatCurrencyCompact(summary.pipeline)}
            hint={`${formatCurrencyCompact(summary.weighted)} váženě · ${summary.openCount} obchodů`}
          />
          <StatCard label="Vyhráno" value={formatCurrencyCompact(summary.closedWon)} hint={`${wonShare} % z celkového objemu`} />
        </StatGrid>

        <Panel className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base leading-none font-semibold">{selectedLabel} po měsících</h2>
            <ul className="caption-style flex flex-wrap gap-3 text-soft">
              {LEGEND.map((item) => (
                <li key={item.key} className="flex items-center gap-1.5">
                  <span aria-hidden className={cn("size-2 rounded-[2px]", item.className)} />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <SegmentBar percent={commitShare} segments={40} className="h-3 w-full" segmentClassName="h-2" />
            <span className="caption-style text-subtle">Jistota forecastu (commit / best case) · {commitShare} %</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {months.map((month) => {
              const segments = [
                { key: "closedWon", value: month.closedWon, className: "bg-success" },
                { key: "commit", value: month.commit - month.closedWon, className: "bg-brand" },
                { key: "bestCase", value: month.bestCase - month.commit, className: "bg-[#7a68ff]" },
                { key: "pipeline", value: month.pipeline + month.closedWon - month.bestCase, className: "bg-track" },
              ];
              return (
                <div key={month.key} className="flex flex-col gap-2">
                  <div
                    className="flex h-[180px] flex-col justify-end overflow-hidden rounded-md bg-white/4"
                    role="img"
                    aria-label={`${month.label}: commit ${formatCurrencyCompact(month.commit)}, best case ${formatCurrencyCompact(month.bestCase)}`}
                  >
                    {segments
                      .slice()
                      .reverse()
                      .map((segment) => (
                        <span
                          key={segment.key}
                          className={cn("block w-full", segment.className)}
                          style={{ height: `${(Math.max(0, segment.value) / peak) * 100}%` }}
                        />
                      ))}
                  </div>
                  <div className="caption-style flex items-center justify-between gap-2">
                    <span className="text-soft capitalize">{month.label}</span>
                    <span className="tabular-nums">{formatCurrencyCompact(month.bestCase)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel className="overflow-hidden">
            <div className="border-b px-4 py-3 text-sm font-medium">Podle obchodníka</div>
            <Table className="min-w-[480px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Obchodník</TableHead>
                  <TableHead className="text-right">Obchody</TableHead>
                  <TableHead className="text-right">Commit</TableHead>
                  <TableHead className="text-right">Best case</TableHead>
                  <TableHead className="text-right">Vážená</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {owners.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <OwnerBadge name={row.name} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyCompact(row.commit)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyCompact(row.bestCase)}</TableCell>
                    <TableCell className="text-right text-soft tabular-nums">{formatCurrencyCompact(row.weighted)}</TableCell>
                  </TableRow>
                ))}
                {owners.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="caption-style h-[120px] text-center text-subtle">
                      V {selectedLabel} se neuzavírá žádný obchod.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="border-b px-4 py-3 text-sm font-medium">Největší otevřené obchody</div>
            <Table className="min-w-[480px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Obchod</TableHead>
                  <TableHead>Fáze</TableHead>
                  <TableHead className="text-right">Hodnota</TableHead>
                  <TableHead className="text-right">Uzavření</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topOpen.map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell className="max-w-[220px]">
                      <Link href={`/crm/deals/${deal.id}`} className="block truncate hover:underline">
                        {deal.name}
                      </Link>
                      {deal.company && <span className="caption-style mt-1 block truncate text-subtle">{deal.company.name}</span>}
                    </TableCell>
                    <TableCell>
                      <Tag tone={stageTone(deal.stage)} size="sm">
                        {deal.stage.name} · {deal.prob} %
                      </Tag>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyCompact(deal.value)}</TableCell>
                    <TableCell className="text-right text-soft tabular-nums">
                      {deal.date.toLocaleDateString("cs-CZ", { day: "numeric", month: "short" })}
                    </TableCell>
                  </TableRow>
                ))}
                {topOpen.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="caption-style h-[120px] text-center text-subtle">
                      Žádné otevřené obchody v tomto období.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Panel>
        </div>
      </div>
    </div>
  );
}

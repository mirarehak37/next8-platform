import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ownerScopeWhere } from "@/lib/scope";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RevenueBarChart, SimpleBarChart, ReasonsChart } from "./report-charts";
import { formatCurrency } from "@/lib/format";
import { Wallet, Trophy, Percent, Users2 } from "lucide-react";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period } = await searchParams;
  const days = period === "30" ? 30 : period === "365" ? 365 : 90;

  const session = await auth();
  const user = session!.user;
  const dealScope = await ownerScopeWhere(user, "deal");
  const since = daysAgo(days);

  const [wonDeals, lostDeals, activities, leads] = await Promise.all([
    prisma.deal.findMany({
      where: { ...dealScope, status: "won", closedAt: { gte: since } },
      include: { owner: { select: { name: true } }, company: { select: { name: true } }, products: true },
    }),
    prisma.deal.findMany({ where: { ...dealScope, status: "lost", closedAt: { gte: since } }, select: { lossReason: true, value: true } }),
    prisma.activity.groupBy({ by: ["ownerId"], where: { tenantId: user.tenantId, activityAt: { gte: since } }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["source"], where: { tenantId: user.tenantId, createdAt: { gte: since } }, _count: { _all: true } }),
  ]);

  const owners = await prisma.user.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true } });
  const ownerNames = new Map(owners.map((o) => [o.id, o.name]));

  const totalWon = wonDeals.reduce((s, d) => s + d.value, 0);
  const totalLost = lostDeals.reduce((s, d) => s + d.value, 0);
  const winRate = wonDeals.length + lostDeals.length > 0 ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100) : 0;
  const avgCycle =
    wonDeals.length > 0
      ? Math.round(wonDeals.reduce((s, d) => s + (d.closedAt!.getTime() - d.createdAt.getTime()) / 86400000, 0) / wonDeals.length)
      : 0;

  // Revenue by sales rep
  const byRep = new Map<string, number>();
  for (const d of wonDeals) byRep.set(d.ownerId, (byRep.get(d.ownerId) ?? 0) + d.value);
  const repData = Array.from(byRep.entries()).map(([id, value]) => ({ label: ownerNames.get(id) ?? "—", value })).sort((a, b) => b.value - a.value).slice(0, 8);

  // Revenue by customer
  const byCustomer = new Map<string, number>();
  for (const d of wonDeals) {
    const name = d.company?.name ?? "Bez firmy";
    byCustomer.set(name, (byCustomer.get(name) ?? 0) + d.value);
  }
  const customerData = Array.from(byCustomer.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);

  // Revenue by product
  const byProduct = new Map<string, number>();
  for (const d of wonDeals) for (const p of d.products) byProduct.set(p.name, (byProduct.get(p.name) ?? 0) + p.total);
  const productData = Array.from(byProduct.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);

  // Loss reasons
  const byReason = new Map<string, number>();
  for (const d of lostDeals) {
    const reason = d.lossReason ?? "Neuvedeno";
    byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
  }
  const reasonData = Array.from(byReason.entries()).map(([reason, count]) => ({ reason, count }));

  // Rep activity
  const activityData = activities
    .map((a) => ({ label: ownerNames.get(a.ownerId) ?? "—", value: a._count._all }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const leadSourceData = leads.map((l) => ({ label: l.source ?? "Neuvedeno", value: l._count._all }));

  const periodLabel = days === 30 ? "posledních 30 dní" : days === 365 ? "posledních 12 měsíců" : "posledních 90 dní";

  return (
    <div>
      <PageHeader title="Reporty" description={`Obchodní výkonnost za ${periodLabel}`} breadcrumbs={[{ label: "Reporty" }]} />
      <div className="p-6 space-y-6">
        <div className="flex gap-2">
          {[
            { value: "30", label: "30 dní" },
            { value: "90", label: "90 dní" },
            { value: "365", label: "12 měsíců" },
          ].map((p) => (
            <a
              key={p.value}
              href={`/reports?period=${p.value}`}
              className={`text-sm px-3 py-1.5 rounded-md border ${days === Number(p.value) ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}
            >
              {p.label}
            </a>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Vyhraná hodnota" value={formatCurrency(totalWon)} icon={Wallet} hint={`${wonDeals.length} obchodů`} />
          <KpiCard label="Ztracená hodnota" value={formatCurrency(totalLost)} icon={Wallet} hint={`${lostDeals.length} obchodů`} />
          <KpiCard label="Úspěšnost" value={`${winRate}%`} icon={Trophy} />
          <KpiCard label="Délka cyklu" value={`${avgCycle} dní`} icon={Percent} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RevenueBarChart title="Obchodní výkon podle obchodníka" description="Vyhraná hodnota" data={repData} />
          <RevenueBarChart title="Obrat podle zákazníka" description="Top 8 zákazníků dle vyhrané hodnoty" data={customerData} />
          <RevenueBarChart title="Obrat podle produktu" description="Nejprodávanější produkty a služby" data={productData} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Users2 className="h-4 w-4" /> Aktivita obchodníků</CardTitle>
              <CardDescription>Počet zaznamenaných aktivit</CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleBarChart data={activityData} format="count" />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ReasonsChart data={reasonData} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Zdroje leadů</CardTitle>
              <CardDescription>Počet nových leadů podle zdroje</CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleBarChart data={leadSourceData} format="count" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

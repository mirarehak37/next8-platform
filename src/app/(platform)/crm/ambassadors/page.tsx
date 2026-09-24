import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { AmbassadorFormDialog } from "@/components/partnerships/ambassador-form-dialog";
import { contractState, oneYearAgo, yearlyValue } from "@/lib/partnerships";
import { formatCurrency } from "@/lib/format";
import { Star, CalendarClock, Wallet, Users } from "lucide-react";
import { AmbassadorsTable, type AmbassadorRow } from "./ambassadors-table";

export default async function AmbassadorsPage() {
  const session = await auth();
  const user = session!.user;
  if (!can(user.role, "ambassador", "view")) redirect("/dashboard");

  const [ambassadors, terms, owners, companies, contacts] = await Promise.all([
    prisma.ambassador.findMany({
      where: { tenantId: user.tenantId },
      include: { owner: { select: { name: true } }, company: { select: { name: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.partnershipTerm.findMany({
      where: { tenantId: user.tenantId, subjectType: "ambassador" },
      // Commission terms and delivery rewards are costed from what was actually logged in the last year.
      include: { fulfillments: { where: { status: "done", date: { gte: oneYearAgo() } }, select: { date: true, quantity: true, amount: true, rewardAmount: true } } },
    }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { tenantId: user.tenantId }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: "asc" } }),
  ]);

  const rows: AmbassadorRow[] = ambassadors.map((a) => {
    const own = terms.filter((t) => t.subjectId === a.id);
    const state = contractState(a.contractEnd);
    return {
      id: a.id,
      fullName: `${a.firstName} ${a.lastName}`,
      nickname: a.nickname,
      companyName: a.company?.name ?? null,
      position: a.position,
      sport: a.sport,
      instagram: a.instagram,
      followers: a.followers,
      status: a.status,
      tier: a.tier,
      contractEnd: a.contractEnd?.toISOString() ?? null,
      contractAlert: a.status === "active" ? state?.label ?? null : null,
      contractAlertColor: state?.color ?? null,
      yearlyCost: yearlyValue(own, "we_give"),
      obligations: own.filter((t) => t.direction === "they_give" && t.isActive).length,
      ownerName: a.owner.name,
    };
  });

  const active = rows.filter((r) => r.status === "active");
  const expiring = active.filter((r) => r.contractAlert).length;
  const totalCost = active.reduce((s, r) => s + r.yearlyCost, 0);
  const reach = active.reduce((s, r) => s + (r.followers ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Ambasadoři"
        description={`${rows.length} ambasadorů v databázi`}
        breadcrumbs={[{ label: "Partnerství" }, { label: "Ambasadoři" }]}
      />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Aktivní ambasadoři" value={String(active.length)} icon={Star} />
          <KpiCard label="Smlouvy ke kontrole" value={String(expiring)} hint="končí do 60 dní nebo vypršely" icon={CalendarClock} />
          <KpiCard label="Náklady za rok (odhad)" value={formatCurrency(totalCost)} hint="aktivní, vč. provizí za 12 měs." icon={Wallet} />
          <KpiCard label="Celkový dosah" value={new Intl.NumberFormat("cs-CZ").format(reach)} hint="sledujících u aktivních" icon={Users} />
        </div>
        <AmbassadorsTable
          data={rows}
          toolbarActions={
            can(user.role, "ambassador", "create") ? (
              <AmbassadorFormDialog
                owners={owners}
                companies={companies}
                contacts={contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
                currentUserId={user.id}
              />
            ) : null
          }
        />
      </div>
    </div>
  );
}

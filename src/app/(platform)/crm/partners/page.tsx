import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PartnerFormDialog } from "@/components/partnerships/partner-form-dialog";
import { contractState, oneYearAgo, yearlyValue } from "@/lib/partnerships";
import { formatCurrency } from "@/lib/format";
import { HeartHandshake, CalendarClock, TrendingUp, Wallet } from "lucide-react";
import { PartnersTable, type PartnerRow } from "./partners-table";

export default async function PartnersPage() {
  const session = await auth();
  const user = session!.user;
  if (!can(user.role, "partner", "view")) redirect("/dashboard");

  const [partners, terms, owners, companies, contacts] = await Promise.all([
    prisma.partner.findMany({
      where: { tenantId: user.tenantId },
      include: { owner: { select: { name: true } }, company: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.partnershipTerm.findMany({
      where: { tenantId: user.tenantId, subjectType: "partner" },
      // Commission terms and delivery rewards are costed from what was actually logged in the last year.
      include: { fulfillments: { where: { date: { gte: oneYearAgo() } }, select: { date: true, quantity: true, amount: true, rewardAmount: true } } },
    }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { tenantId: user.tenantId }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: "asc" } }),
  ]);

  const rows: PartnerRow[] = partners.map((p) => {
    const own = terms.filter((t) => t.subjectId === p.id);
    const state = contractState(p.contractEnd);
    return {
      id: p.id,
      name: p.name,
      kind: p.kind,
      level: p.level,
      clubName: p.company?.name ?? null,
      contactName: p.contact ? `${p.contact.firstName} ${p.contact.lastName}` : null,
      status: p.status,
      contractEnd: p.contractEnd?.toISOString() ?? null,
      contractAlert: p.status === "active" ? state?.label ?? null : null,
      contractAlertColor: state?.color ?? null,
      theyGiveYearly: yearlyValue(own, "they_give"),
      weGiveYearly: yearlyValue(own, "we_give"),
      ownerName: p.owner.name,
    };
  });

  const active = rows.filter((r) => r.status === "active");
  const expiring = active.filter((r) => r.contractAlert).length;
  const theyGive = active.reduce((s, r) => s + r.theyGiveYearly, 0);
  const weGive = active.reduce((s, r) => s + r.weGiveYearly, 0);

  return (
    <div>
      <PageHeader
        title="Partneři a sponzoring"
        description={`${rows.length} partnerů a sponzorů`}
        breadcrumbs={[{ label: "Partnerství" }, { label: "Partneři a sponzoring" }]}
      />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Aktivní partnerství" value={String(active.length)} icon={HeartHandshake} />
          <KpiCard label="Smlouvy ke kontrole" value={String(expiring)} hint="končí do 60 dní nebo vypršely" icon={CalendarClock} />
          <KpiCard label="Přínos partnerů za rok" value={formatCurrency(theyGive)} hint="finanční a věcné plnění" icon={TrendingUp} />
          <KpiCard label="Naše protiplnění za rok" value={formatCurrency(weGive)} icon={Wallet} />
        </div>
        <PartnersTable
          data={rows}
          toolbarActions={
            can(user.role, "partner", "create") ? (
              <PartnerFormDialog
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

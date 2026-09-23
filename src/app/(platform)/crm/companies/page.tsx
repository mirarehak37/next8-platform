import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ownerScopeWhere } from "@/lib/scope";
import { PageHeader } from "@/components/page-header";
import { CompaniesTable, type CompanyRow } from "./companies-table";

export default async function CompaniesPage() {
  const session = await auth();
  const user = session!.user;

  const scope = await ownerScopeWhere(user, "company");
  const [companies, owners] = await Promise.all([
    prisma.company.findMany({
      where: scope,
      include: { owner: { select: { name: true } }, _count: { select: { deals: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const rows: CompanyRow[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    industry: c.industry,
    segment: c.segment,
    status: c.status,
    city: c.billingCity,
    employeeCount: c.employeeCount,
    annualRevenue: c.annualRevenue,
    ownerName: c.owner.name,
    dealCount: c._count.deals,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader
        title="Firmy"
        description={`${rows.length} firem v databázi`}
        breadcrumbs={[{ label: "CRM" }, { label: "Firmy" }]}
      />
      <div className="p-6">
        <CompaniesTable data={rows} owners={owners} />
      </div>
    </div>
  );
}

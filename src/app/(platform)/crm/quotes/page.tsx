import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ownerScopeWhere } from "@/lib/scope";
import { PageHeader } from "@/components/page-header";
import { QuotesTable, type QuoteRow } from "./quotes-table";

export default async function QuotesPage() {
  const session = await auth();
  const user = session!.user;

  const scope = await ownerScopeWhere(user, "quote");
  const [quotes, companies, deals, products, contacts] = await Promise.all([
    prisma.quote.findMany({ where: scope, include: { company: { select: { name: true } }, owner: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.deal.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { tenantId: user.tenantId, isActive: true }, select: { id: true, name: true, price: true, vatRate: true }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { tenantId: user.tenantId }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: "asc" } }),
  ]);
  const contactOptions = contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }));

  const rows: QuoteRow[] = quotes.map((q) => ({
    id: q.id,
    number: q.number,
    companyName: q.company?.name ?? null,
    total: q.total,
    currency: q.currency,
    status: q.status,
    validUntil: q.validUntil?.toISOString() ?? null,
    ownerName: q.owner.name,
  }));

  return (
    <div>
      <PageHeader title="Nabídky" description={`${rows.length} nabídek`} breadcrumbs={[{ label: "CRM" }, { label: "Nabídky" }]} />
      <div className="p-6">
        <QuotesTable data={rows} companies={companies} deals={deals} products={products} contacts={contactOptions} />
      </div>
    </div>
  );
}

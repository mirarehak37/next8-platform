import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ProductsTable, type ProductRow } from "./products-table";

export default async function ProductsPage() {
  const session = await auth();
  const user = session!.user;

  const products = await prisma.product.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } });

  const rows: ProductRow[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    category: p.category,
    price: p.price,
    vatRate: p.vatRate,
    unit: p.unit,
    isRecurring: p.isRecurring,
    billingPeriod: p.billingPeriod,
    isActive: p.isActive,
    description: p.description,
  }));

  return (
    <div>
      <PageHeader title="Produkty" description={`${rows.length} produktů a služeb v katalogu`} breadcrumbs={[{ label: "CRM" }, { label: "Produkty" }]} />
      <div className="p-6">
        <ProductsTable data={rows} />
      </div>
    </div>
  );
}

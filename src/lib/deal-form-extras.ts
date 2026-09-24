import { prisma } from "@/lib/prisma";

export type DealFormExtras = {
  teams: { id: string; name: string; category: string; companyId: string }[];
  products: { id: string; name: string; price: number; category: string | null; billingPeriod: string | null; isActive: boolean }[];
  ambassadors: { id: string; name: string; discountCode: string | null; terms: { id: string; title: string; percent: number }[] }[];
};

// Options for the deal form: teams per club, catalog packages (subscriptions first)
// and ambassadors with their percentage commission terms.
export async function loadDealFormExtras(tenantId: string): Promise<DealFormExtras> {
  const [teams, products, ambassadors, terms] = await Promise.all([
    prisma.clubTeam.findMany({ where: { tenantId }, select: { id: true, name: true, category: true, companyId: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.product.findMany({ where: { tenantId }, select: { id: true, name: true, price: true, category: true, billingPeriod: true, isActive: true }, orderBy: { name: "asc" } }),
    prisma.ambassador.findMany({ where: { tenantId, status: { not: "ended" } }, select: { id: true, firstName: true, lastName: true, discountCode: true }, orderBy: { lastName: "asc" } }),
    prisma.partnershipTerm.findMany({
      where: { tenantId, subjectType: "ambassador", direction: "we_give", valueType: "percent", isActive: true, percent: { not: null } },
      select: { id: true, subjectId: true, title: true, percent: true },
      orderBy: { percent: "desc" },
    }),
  ]);
  const isSub = (c: string | null) => /předplatn/i.test(c ?? "");
  return {
    teams,
    products: products.sort((a, b) => Number(isSub(b.category)) - Number(isSub(a.category))),
    ambassadors: ambassadors.map((a) => ({
      id: a.id,
      name: `${a.firstName} ${a.lastName}`,
      discountCode: a.discountCode,
      terms: terms.filter((t) => t.subjectId === a.id).map((t) => ({ id: t.id, title: t.title, percent: t.percent! })),
    })),
  };
}

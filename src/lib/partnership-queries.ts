import { prisma } from "@/lib/prisma";
import type { TermView } from "@/components/partnerships/terms-panel";
import type { AttachmentView } from "@/components/partnerships/attachments-panel";

// Everything the ambassador/partner detail pages load besides the record itself.
export async function loadPartnershipExtras(tenantId: string, subjectType: "ambassador" | "partner", subjectId: string) {
  const [terms, attachments, auditLogs] = await Promise.all([
    prisma.partnershipTerm.findMany({
      where: { tenantId, subjectType, subjectId },
      include: {
        fulfillments: { include: { recordedBy: { select: { name: true } }, product: { select: { name: true } } }, orderBy: { date: "desc" } },
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    }),
    prisma.attachment.findMany({
      where: { tenantId, entityType: subjectType, entityId: subjectId },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { tenantId, entityType: subjectType, entityId: subjectId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const termViews: TermView[] = terms.map((t) => ({
    id: t.id,
    direction: t.direction as TermView["direction"],
    type: t.type,
    title: t.title,
    description: t.description,
    valueType: t.valueType,
    amount: t.amount,
    percent: t.percent,
    percentBase: t.percentBase,
    productIds: t.productIds,
    quantity: t.quantity,
    period: t.period,
    dueDate: t.dueDate?.toISOString() ?? null,
    isActive: t.isActive,
    fulfillments: t.fulfillments.map((f) => ({
      id: f.id,
      date: f.date.toISOString(),
      quantity: f.quantity,
      productName: f.product?.name ?? null,
      baseAmount: f.baseAmount,
      amount: f.amount,
      link: f.link,
      note: f.note,
      recordedBy: f.recordedBy.name,
    })),
  }));

  const attachmentViews: AttachmentView[] = attachments.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    fileSize: a.fileSize,
    category: a.category,
    uploadedBy: a.uploadedBy.name,
    createdAt: a.createdAt.toISOString(),
  }));

  return { terms: termViews, attachments: attachmentViews, auditLogs, products: await loadProductOptions(tenantId) };
}

export type ProductOption = { id: string; name: string; price: number; category: string | null; isActive: boolean };

// Catalog products commission terms can refer to — subscription packages first.
export async function loadProductOptions(tenantId: string): Promise<ProductOption[]> {
  const products = await prisma.product.findMany({
    where: { tenantId },
    select: { id: true, name: true, price: true, category: true, isActive: true },
    orderBy: { name: "asc" },
  });
  const isSubscription = (p: ProductOption) => /předplatn/i.test(p.category ?? "");
  return products.sort((a, b) => Number(isSubscription(b)) - Number(isSubscription(a)));
}

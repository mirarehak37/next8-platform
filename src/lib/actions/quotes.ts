"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError } from "@/lib/actions/helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const quoteItemSchema = z.object({
  productId: z.string().optional().nullable(),
  name: z.string().min(1),
  quantity: z.coerce.number().min(0.01),
  unitPrice: z.coerce.number().min(0),
  vatRate: z.coerce.number().min(0).default(21),
});

const createQuoteSchema = z.object({
  dealId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(quoteItemSchema).min(1, "Přidejte alespoň jednu položku"),
});

async function nextQuoteNumber(tenantId: string) {
  const seq = await prisma.numberSequence.upsert({
    where: { tenantId_code: { tenantId, code: "quote" } },
    update: { nextNumber: { increment: 1 } },
    create: { tenantId, code: "quote", prefix: `NAB-${new Date().getFullYear()}-`, nextNumber: 2 },
  });
  return `${seq.prefix}${String(seq.nextNumber - 1).padStart(4, "0")}`;
}

export async function createQuote(data: unknown) {
  const user = await requirePermission("quote", "create");
  const parsed = createQuoteSchema.parse(data);

  const subtotal = parsed.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vatTotal = parsed.items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.vatRate / 100), 0);
  const number = await nextQuoteNumber(user.tenantId);

  const quote = await prisma.quote.create({
    data: {
      tenantId: user.tenantId,
      number,
      dealId: parsed.dealId || undefined,
      companyId: parsed.companyId || undefined,
      contactId: parsed.contactId || undefined,
      validUntil: parsed.validUntil ? new Date(parsed.validUntil) : undefined,
      terms: parsed.terms,
      notes: parsed.notes,
      ownerId: user.id,
      subtotal,
      vatTotal,
      total: subtotal + vatTotal,
      items: {
        create: parsed.items.map((i, idx) => ({
          productId: i.productId || undefined,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          vatRate: i.vatRate,
          total: i.quantity * i.unitPrice,
          order: idx,
        })),
      },
    },
  });

  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "quote", entityId: quote.id, action: "create" });
  revalidatePath("/crm/quotes");
  return quote;
}

export async function setQuoteStatus(id: string, status: string) {
  const user = await requirePermission("quote", "edit");
  const existing = await prisma.quote.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Nabídka nenalezena.");
  await prisma.quote.update({ where: { id }, data: { status } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "quote", entityId: id, action: "status_change", changes: { status } });
  revalidatePath("/crm/quotes");
  revalidatePath(`/crm/quotes/${id}`);
}

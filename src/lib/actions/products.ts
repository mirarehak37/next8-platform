"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError } from "@/lib/actions/helpers";
import { productSchema } from "@/lib/validations/crm";
import { revalidatePath } from "next/cache";

export async function createProduct(data: unknown) {
  const user = await requirePermission("product", "create");
  const parsed = productSchema.parse(data);
  const product = await prisma.product.create({ data: { ...parsed, tenantId: user.tenantId } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "product", entityId: product.id, action: "create" });
  revalidatePath("/crm/products");
  return product;
}

export async function updateProduct(id: string, data: unknown) {
  const user = await requirePermission("product", "edit");
  const parsed = productSchema.partial().parse(data);
  const existing = await prisma.product.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Produkt nenalezen.");
  const product = await prisma.product.update({ where: { id }, data: parsed });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "product", entityId: id, action: "update", changes: parsed });
  revalidatePath("/crm/products");
  return product;
}

export async function deleteProduct(id: string) {
  const user = await requirePermission("product", "delete");
  const existing = await prisma.product.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Produkt nenalezen.");
  await prisma.product.delete({ where: { id } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "product", entityId: id, action: "delete" });
  revalidatePath("/crm/products");
}

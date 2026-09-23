"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError } from "@/lib/actions/helpers";
import { companySchema } from "@/lib/validations/crm";
import { revalidatePath } from "next/cache";

export async function createCompany(data: unknown) {
  const user = await requirePermission("company", "create");
  const parsed = companySchema.parse(data);

  const company = await prisma.company.create({
    data: { ...parsed, tenantId: user.tenantId },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "company", entityId: company.id, action: "create" });
  revalidatePath("/crm/companies");
  return company;
}

export async function updateCompany(id: string, data: unknown) {
  const user = await requirePermission("company", "edit");
  const parsed = companySchema.partial().parse(data);

  const existing = await prisma.company.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Klub nenalezen.");

  const company = await prisma.company.update({ where: { id }, data: parsed });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "company", entityId: id, action: "update", changes: parsed });
  revalidatePath("/crm/companies");
  revalidatePath(`/crm/companies/${id}`);
  return company;
}

export async function deleteCompany(id: string) {
  const user = await requirePermission("company", "delete");
  const existing = await prisma.company.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Klub nenalezen.");

  await prisma.company.delete({ where: { id } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "company", entityId: id, action: "delete" });
  revalidatePath("/crm/companies");
}

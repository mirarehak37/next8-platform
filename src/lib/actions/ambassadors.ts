"use server";

import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError } from "@/lib/actions/helpers";
import { ambassadorSchema } from "@/lib/validations/partnerships";
import { revalidatePath } from "next/cache";

type Parsed = Partial<z.output<typeof ambassadorSchema>>;

function toData(parsed: Parsed) {
  const { birthDate, contractStart, contractEnd, companyId, contactId, ...rest } = parsed;
  return {
    ...rest,
    ...(birthDate !== undefined && { birthDate: birthDate ? new Date(birthDate) : null }),
    ...(contractStart !== undefined && { contractStart: contractStart ? new Date(contractStart) : null }),
    ...(contractEnd !== undefined && { contractEnd: contractEnd ? new Date(contractEnd) : null }),
    ...(companyId !== undefined && { companyId: companyId || null }),
    ...(contactId !== undefined && { contactId: contactId || null }),
  };
}

export async function createAmbassador(data: unknown) {
  const user = await requirePermission("ambassador", "create");
  const parsed = ambassadorSchema.parse(data);
  const ambassador = await prisma.ambassador.create({ data: { ...toData(parsed), ownerId: parsed.ownerId, firstName: parsed.firstName, lastName: parsed.lastName, tenantId: user.tenantId } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "ambassador", entityId: ambassador.id, action: "create" });
  revalidatePath("/crm/ambassadors");
  return ambassador;
}

export async function updateAmbassador(id: string, data: unknown) {
  const user = await requirePermission("ambassador", "edit");
  const parsed = ambassadorSchema.partial().parse(data);
  const existing = await prisma.ambassador.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Ambasador nenalezen.");
  const ambassador = await prisma.ambassador.update({ where: { id }, data: toData(parsed) });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "ambassador", entityId: id, action: "update", changes: parsed });
  revalidatePath("/crm/ambassadors");
  revalidatePath(`/crm/ambassadors/${id}`);
  return ambassador;
}

export async function deleteAmbassador(id: string) {
  const user = await requirePermission("ambassador", "delete");
  const existing = await prisma.ambassador.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Ambasador nenalezen.");
  // Terms and attachments are polymorphic (no FK), so clean them up explicitly.
  await prisma.$transaction([
    prisma.partnershipTerm.deleteMany({ where: { tenantId: user.tenantId, subjectType: "ambassador", subjectId: id } }),
    prisma.attachment.deleteMany({ where: { tenantId: user.tenantId, entityType: "ambassador", entityId: id } }),
    prisma.ambassador.delete({ where: { id } }),
  ]);
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "ambassador", entityId: id, action: "delete" });
  revalidatePath("/crm/ambassadors");
}

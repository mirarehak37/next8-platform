"use server";

import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError } from "@/lib/actions/helpers";
import { partnerSchema } from "@/lib/validations/partnerships";
import { revalidatePath } from "next/cache";

type Parsed = Partial<z.output<typeof partnerSchema>>;

function toData(parsed: Parsed) {
  const { contractStart, contractEnd, companyId, contactId, ...rest } = parsed;
  return {
    ...rest,
    ...(contractStart !== undefined && { contractStart: contractStart ? new Date(contractStart) : null }),
    ...(contractEnd !== undefined && { contractEnd: contractEnd ? new Date(contractEnd) : null }),
    ...(companyId !== undefined && { companyId: companyId || null }),
    ...(contactId !== undefined && { contactId: contactId || null }),
  };
}

export async function createPartner(data: unknown) {
  const user = await requirePermission("partner", "create");
  const parsed = partnerSchema.parse(data);
  const partner = await prisma.partner.create({ data: { ...toData(parsed), ownerId: parsed.ownerId, name: parsed.name, tenantId: user.tenantId } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "partner", entityId: partner.id, action: "create" });
  revalidatePath("/crm/partners");
  return partner;
}

export async function updatePartner(id: string, data: unknown) {
  const user = await requirePermission("partner", "edit");
  const parsed = partnerSchema.partial().parse(data);
  const existing = await prisma.partner.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Partner nenalezen.");
  const partner = await prisma.partner.update({ where: { id }, data: toData(parsed) });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "partner", entityId: id, action: "update", changes: parsed });
  revalidatePath("/crm/partners");
  revalidatePath(`/crm/partners/${id}`);
  return partner;
}

export async function deletePartner(id: string) {
  const user = await requirePermission("partner", "delete");
  const existing = await prisma.partner.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Partner nenalezen.");
  // Terms and attachments are polymorphic (no FK), so clean them up explicitly.
  await prisma.$transaction([
    prisma.partnershipTerm.deleteMany({ where: { tenantId: user.tenantId, subjectType: "partner", subjectId: id } }),
    prisma.attachment.deleteMany({ where: { tenantId: user.tenantId, entityType: "partner", entityId: id } }),
    prisma.partner.delete({ where: { id } }),
  ]);
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "partner", entityId: id, action: "delete" });
  revalidatePath("/crm/partners");
}

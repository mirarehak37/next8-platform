"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError } from "@/lib/actions/helpers";
import { contactSchema } from "@/lib/validations/crm";
import { revalidatePath } from "next/cache";

export async function createContact(data: unknown) {
  const user = await requirePermission("contact", "create");
  const parsed = contactSchema.parse(data);
  const { companyId, ...rest } = parsed;

  const contact = await prisma.contact.create({ data: { ...rest, tenantId: user.tenantId } });
  if (companyId) {
    await prisma.companyContact.create({ data: { companyId, contactId: contact.id, isPrimary: true } });
  }
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "contact", entityId: contact.id, action: "create" });
  revalidatePath("/crm/contacts");
  if (companyId) revalidatePath(`/crm/companies/${companyId}`);
  return contact;
}

export async function updateContact(id: string, data: unknown) {
  const user = await requirePermission("contact", "edit");
  const parsed = contactSchema.partial().parse(data);
  const { companyId, ...rest } = parsed;

  const existing = await prisma.contact.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Kontakt nenalezen.");

  const contact = await prisma.contact.update({ where: { id }, data: rest });

  if (companyId !== undefined) {
    await prisma.companyContact.deleteMany({ where: { contactId: id } });
    if (companyId) {
      await prisma.companyContact.create({ data: { companyId, contactId: id, isPrimary: true } });
    }
  }

  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "contact", entityId: id, action: "update", changes: rest });
  revalidatePath("/crm/contacts");
  revalidatePath(`/crm/contacts/${id}`);
  return contact;
}

export async function deleteContact(id: string) {
  const user = await requirePermission("contact", "delete");
  const existing = await prisma.contact.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Kontakt nenalezen.");

  await prisma.contact.delete({ where: { id } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "contact", entityId: id, action: "delete" });
  revalidatePath("/crm/contacts");
}

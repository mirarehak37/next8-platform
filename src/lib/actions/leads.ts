"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError } from "@/lib/actions/helpers";
import { leadSchema } from "@/lib/validations/crm";
import { revalidatePath } from "next/cache";

export async function createLead(data: unknown) {
  const user = await requirePermission("lead", "create");
  const parsed = leadSchema.parse(data);
  const lead = await prisma.lead.create({ data: { ...parsed, tenantId: user.tenantId } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "lead", entityId: lead.id, action: "create" });
  revalidatePath("/crm/leads");
  return lead;
}

export async function updateLead(id: string, data: unknown) {
  const user = await requirePermission("lead", "edit");
  const parsed = leadSchema.partial().parse(data);
  const existing = await prisma.lead.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Lead nenalezen.");
  const lead = await prisma.lead.update({ where: { id }, data: parsed });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "lead", entityId: id, action: "update", changes: parsed });
  revalidatePath("/crm/leads");
  return lead;
}

export async function setLeadStatus(id: string, status: string) {
  const user = await requirePermission("lead", "edit");
  const existing = await prisma.lead.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Lead nenalezen.");
  await prisma.lead.update({ where: { id }, data: { status } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "lead", entityId: id, action: "status_change", changes: { status } });
  revalidatePath("/crm/leads");
}

export async function deleteLead(id: string) {
  const user = await requirePermission("lead", "delete");
  const existing = await prisma.lead.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Lead nenalezen.");
  await prisma.lead.delete({ where: { id } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "lead", entityId: id, action: "delete" });
  revalidatePath("/crm/leads");
}

// Lead qualification -> Company + Contact + Deal, mirroring the classic CRM convert flow (spec section 5).
export async function convertLead(id: string, pipelineId: string, stageId: string) {
  const user = await requirePermission("lead", "edit");
  const lead = await prisma.lead.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!lead) throw new ActionError("Lead nenalezen.");

  const result = await prisma.$transaction(async (tx) => {
    let company = null;
    if (lead.companyName) {
      company = await tx.company.create({
        data: {
          tenantId: user.tenantId,
          name: lead.companyName,
          ownerId: lead.ownerId,
          source: lead.source,
          status: "prospect",
        },
      });
    }

    const contact = await tx.contact.create({
      data: {
        tenantId: user.tenantId,
        firstName: lead.firstName ?? "Neznámé",
        lastName: lead.lastName ?? "jméno",
        email: lead.email,
        phone: lead.phone,
        jobTitle: lead.jobTitle,
        ownerId: lead.ownerId,
        source: lead.source,
      },
    });
    if (company) {
      await tx.companyContact.create({ data: { companyId: company.id, contactId: contact.id, isPrimary: true } });
    }

    const deal = await tx.deal.create({
      data: {
        tenantId: user.tenantId,
        name: `${lead.companyName ?? contact.lastName} – nová příležitost`,
        companyId: company?.id,
        primaryContactId: contact.id,
        ownerId: lead.ownerId,
        pipelineId,
        stageId,
        value: lead.estimatedValue ?? 0,
        source: lead.source,
      },
    });
    if (company) {
      await tx.dealContact.create({ data: { dealId: deal.id, contactId: contact.id, role: "Rozhodovatel" } });
    }

    await tx.lead.update({
      where: { id },
      data: { status: "converted", convertedCompanyId: company?.id, convertedContactId: contact.id, convertedDealId: deal.id },
    });

    return { company, contact, deal };
  });

  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "lead", entityId: id, action: "convert", changes: result });
  revalidatePath("/crm/leads");
  revalidatePath("/crm/companies");
  revalidatePath("/crm/deals");
  return result;
}

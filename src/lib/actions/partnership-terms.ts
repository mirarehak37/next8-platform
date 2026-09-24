"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError } from "@/lib/actions/helpers";
import { partnershipTermSchema, partnershipFulfillmentSchema } from "@/lib/validations/partnerships";
import { revalidatePath } from "next/cache";

type SubjectType = "ambassador" | "partner";

const SUBJECT_PATHS: Record<SubjectType, string> = { ambassador: "/crm/ambassadors", partner: "/crm/partners" };

async function assertSubject(tenantId: string, subjectType: SubjectType, subjectId: string) {
  const exists =
    subjectType === "ambassador"
      ? await prisma.ambassador.findFirst({ where: { id: subjectId, tenantId }, select: { id: true } })
      : await prisma.partner.findFirst({ where: { id: subjectId, tenantId }, select: { id: true } });
  if (!exists) throw new ActionError("Záznam nenalezen.");
}

function revalidateSubject(subjectType: string, subjectId: string) {
  const base = SUBJECT_PATHS[subjectType as SubjectType];
  if (!base) return;
  revalidatePath(base);
  revalidatePath(`${base}/${subjectId}`);
}

// Loads a term and checks the caller may edit its parent record.
async function requireTerm(termId: string) {
  const term = await prisma.partnershipTerm.findUnique({ where: { id: termId } });
  if (!term) throw new ActionError("Podmínka nenalezena.");
  const user = await requirePermission(term.subjectType as SubjectType, "edit");
  if (term.tenantId !== user.tenantId) throw new ActionError("Podmínka nenalezena.");
  return { term, user };
}

export async function createPartnershipTerm(data: unknown) {
  const parsed = partnershipTermSchema.parse(data);
  const user = await requirePermission(parsed.subjectType, "edit");
  await assertSubject(user.tenantId, parsed.subjectType, parsed.subjectId);

  const term = await prisma.partnershipTerm.create({
    data: { ...parsed, dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null, tenantId: user.tenantId },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: parsed.subjectType, entityId: parsed.subjectId, action: "term_create", changes: { title: term.title } });
  revalidateSubject(parsed.subjectType, parsed.subjectId);
  return term;
}

export async function updatePartnershipTerm(id: string, data: unknown) {
  const { term, user } = await requireTerm(id);
  // Subject and direction are fixed once created — only the term's content changes.
  const parsed = partnershipTermSchema.omit({ subjectType: true, subjectId: true, direction: true }).partial().parse(data);
  const { dueDate, ...rest } = parsed;
  const updated = await prisma.partnershipTerm.update({
    where: { id },
    data: { ...rest, ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }) },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: term.subjectType, entityId: term.subjectId, action: "term_update", changes: parsed });
  revalidateSubject(term.subjectType, term.subjectId);
  return updated;
}

export async function deletePartnershipTerm(id: string) {
  const { term, user } = await requireTerm(id);
  await prisma.partnershipTerm.delete({ where: { id } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: term.subjectType, entityId: term.subjectId, action: "term_delete", changes: { title: term.title } });
  revalidateSubject(term.subjectType, term.subjectId);
}

export async function createPartnershipFulfillment(data: unknown) {
  const parsed = partnershipFulfillmentSchema.parse(data);
  const { term, user } = await requireTerm(parsed.termId);
  const fulfillment = await prisma.partnershipFulfillment.create({
    data: { ...parsed, date: new Date(parsed.date), tenantId: user.tenantId, recordedById: user.id },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: term.subjectType, entityId: term.subjectId, action: "fulfillment_create", changes: { term: term.title } });
  revalidateSubject(term.subjectType, term.subjectId);
  return fulfillment;
}

export async function deletePartnershipFulfillment(id: string) {
  const fulfillment = await prisma.partnershipFulfillment.findUnique({ where: { id } });
  if (!fulfillment) throw new ActionError("Záznam nenalezen.");
  const { term } = await requireTerm(fulfillment.termId);
  await prisma.partnershipFulfillment.delete({ where: { id } });
  revalidateSubject(term.subjectType, term.subjectId);
}

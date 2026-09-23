"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError } from "@/lib/actions/helpers";
import { dealSchema } from "@/lib/validations/crm";
import { revalidatePath } from "next/cache";

export async function createDeal(data: unknown) {
  const user = await requirePermission("deal", "create");
  const parsed = dealSchema.parse(data);
  const stage = await prisma.pipelineStage.findUnique({ where: { id: parsed.stageId } });

  const deal = await prisma.deal.create({
    data: {
      ...parsed,
      expectedCloseDate: parsed.expectedCloseDate ? new Date(parsed.expectedCloseDate) : undefined,
      nextStepDate: parsed.nextStepDate ? new Date(parsed.nextStepDate) : undefined,
      probability: stage?.probability,
      tenantId: user.tenantId,
    },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "deal", entityId: deal.id, action: "create" });
  revalidatePath("/crm/deals");
  return deal;
}

export async function updateDeal(id: string, data: unknown) {
  const user = await requirePermission("deal", "edit");
  const parsed = dealSchema.partial().parse(data);
  const existing = await prisma.deal.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Obchodní případ nenalezen.");

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      ...parsed,
      expectedCloseDate: parsed.expectedCloseDate ? new Date(parsed.expectedCloseDate) : undefined,
      nextStepDate: parsed.nextStepDate ? new Date(parsed.nextStepDate) : undefined,
    },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "deal", entityId: id, action: "update", changes: parsed });
  revalidatePath("/crm/deals");
  revalidatePath(`/crm/deals/${id}`);
  return deal;
}

// Drives the Kanban drag&drop, and doubles as the entry point the workflow-rule
// engine skeleton hooks into (see WorkflowRule "Nabídka" seed example).
export async function moveDealStage(id: string, stageId: string) {
  const user = await requirePermission("deal", "edit");
  const existing = await prisma.deal.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Obchodní případ nenalezen.");

  const stage = await prisma.pipelineStage.findUnique({ where: { id: stageId } });
  if (!stage) throw new ActionError("Fáze nenalezena.");

  const status = stage.isWon ? "won" : stage.isLost ? "lost" : "open";
  const deal = await prisma.deal.update({
    where: { id },
    data: {
      stageId,
      probability: stage.probability,
      status,
      closedAt: status !== "open" ? new Date() : null,
    },
  });

  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "deal", entityId: id, action: "status_change", changes: { stageId, status } });

  if (stage.name === "Nabídka") {
    await prisma.task.create({
      data: {
        tenantId: user.tenantId,
        title: `Připravit a odeslat nabídku – ${existing.name}`,
        assigneeId: existing.ownerId,
        creatorId: user.id,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        priority: "high",
        subjectType: "deal",
        subjectId: id,
      },
    });
  }

  revalidatePath("/crm/deals");
  revalidatePath(`/crm/deals/${id}`);
  return deal;
}

export async function deleteDeal(id: string) {
  const user = await requirePermission("deal", "delete");
  const existing = await prisma.deal.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Obchodní případ nenalezen.");
  await prisma.deal.delete({ where: { id } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "deal", entityId: id, action: "delete" });
  revalidatePath("/crm/deals");
}

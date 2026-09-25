"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError, onlyProvided } from "@/lib/actions/helpers";
import { dealSchema } from "@/lib/validations/crm";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { syncDealCommission } from "@/lib/deal-commission";
import { AMBASSADOR_SOURCE } from "@/lib/constants";

type DealParsed = Partial<z.output<typeof dealSchema>>;

// Validates the references and normalises the package / ambassador fields.
async function dealRefs(tenantId: string, parsed: DealParsed) {
  const out: Record<string, unknown> = {};
  if (parsed.clubTeamId !== undefined) {
    if (parsed.clubTeamId) {
      const team = await prisma.clubTeam.findFirst({ where: { id: parsed.clubTeamId, tenantId }, select: { companyId: true } });
      if (!team) throw new ActionError("Tým nenalezen.");
      if (parsed.companyId && team.companyId !== parsed.companyId) throw new ActionError("Tým nepatří k vybranému klubu.");
    }
    out.clubTeamId = parsed.clubTeamId || null;
  }
  if (parsed.productId !== undefined) {
    if (parsed.productId && !(await prisma.product.findFirst({ where: { id: parsed.productId, tenantId }, select: { id: true } }))) {
      throw new ActionError("Balíček nenalezen.");
    }
    out.productId = parsed.productId || null;
  }
  if (parsed.source !== undefined || parsed.ambassadorId !== undefined || parsed.commissionTermId !== undefined || parsed.commissionAmount !== undefined) {
    const viaAmbassador = parsed.source === AMBASSADOR_SOURCE;
    out.commissionAmount = viaAmbassador && parsed.ambassadorId ? parsed.commissionAmount ?? null : null;
    const ambassadorId = viaAmbassador ? parsed.ambassadorId || null : null;
    let commissionTermId = viaAmbassador ? parsed.commissionTermId || null : null;
    if (ambassadorId && !(await prisma.ambassador.findFirst({ where: { id: ambassadorId, tenantId }, select: { id: true } }))) {
      throw new ActionError("Ambasador nenalezen.");
    }
    if (commissionTermId) {
      const term = await prisma.partnershipTerm.findFirst({ where: { id: commissionTermId, tenantId, subjectType: "ambassador", subjectId: ambassadorId ?? "", direction: "we_give" } });
      if (!term) commissionTermId = null;
    }
    out.ambassadorId = ambassadorId;
    out.commissionTermId = commissionTermId;
  }
  return out;
}

async function stageStatus(stageId: string | undefined) {
  if (!stageId) return null;
  const stage = await prisma.pipelineStage.findUnique({ where: { id: stageId } });
  if (!stage) return null;
  return { stage, status: stage.isWon ? "won" : stage.isLost ? "lost" : "open" };
}

export async function createDeal(data: unknown) {
  const user = await requirePermission("deal", "create");
  const parsed = dealSchema.parse(data);
  const st = await stageStatus(parsed.stageId);

  const deal = await prisma.deal.create({
    data: {
      ...parsed,
      ...(await dealRefs(user.tenantId, parsed)),
      expectedCloseDate: parsed.expectedCloseDate ? new Date(parsed.expectedCloseDate) : undefined,
      nextStepDate: parsed.nextStepDate ? new Date(parsed.nextStepDate) : undefined,
      probability: st?.stage.probability,
      // Creating a deal straight in "Vyhráno" / "Prohráno" closes it right away.
      status: st?.status ?? "open",
      closedAt: st && st.status !== "open" ? new Date() : null,
      tenantId: user.tenantId,
    },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "deal", entityId: deal.id, action: "create" });
  await syncDealCommission(user.tenantId, deal.id, user.id);
  revalidateDeal(deal.id, deal.ambassadorId);
  return deal;
}

export async function updateDeal(id: string, data: unknown) {
  const user = await requirePermission("deal", "edit");
  const parsed = onlyProvided(dealSchema.partial().parse(data), data);
  const existing = await prisma.deal.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Obchodní případ nenalezen.");

  // Changing the stage in the form must close / reopen the deal like the Kanban does.
  const st = parsed.stageId && parsed.stageId !== existing.stageId ? await stageStatus(parsed.stageId) : null;
  const deal = await prisma.deal.update({
    where: { id },
    data: {
      ...parsed,
      ...(await dealRefs(user.tenantId, { companyId: existing.companyId, ...parsed })),
      expectedCloseDate: parsed.expectedCloseDate ? new Date(parsed.expectedCloseDate) : undefined,
      nextStepDate: parsed.nextStepDate ? new Date(parsed.nextStepDate) : undefined,
      ...(st && {
        probability: st.stage.probability,
        status: st.status,
        closedAt: st.status !== "open" ? existing.closedAt ?? new Date() : null,
      }),
    },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "deal", entityId: id, action: "update", changes: parsed });
  await syncDealCommission(user.tenantId, id, user.id);
  revalidateDeal(id, deal.ambassadorId ?? existing.ambassadorId);
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
  await syncDealCommission(user.tenantId, id, user.id);

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

  revalidateDeal(id, deal.ambassadorId);
  return deal;
}

export async function deleteDeal(id: string) {
  const user = await requirePermission("deal", "delete");
  const existing = await prisma.deal.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Obchodní případ nenalezen.");
  await prisma.deal.delete({ where: { id } });
  await syncDealCommission(user.tenantId, id, user.id); // drops an unpaid commission
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "deal", entityId: id, action: "delete" });
  revalidateDeal(id, existing.ambassadorId);
}

function revalidateDeal(id: string, ambassadorId: string | null) {
  revalidatePath("/crm/deals");
  revalidatePath(`/crm/deals/${id}`);
  if (ambassadorId) {
    revalidatePath(`/crm/ambassadors/${ambassadorId}`);
    revalidatePath("/crm/ambassadors/content");
  }
}

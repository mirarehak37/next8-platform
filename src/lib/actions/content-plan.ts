"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError } from "@/lib/actions/helpers";
import { importContentPlan as importPlan } from "@/lib/content-plan-import";
import type { ContentPlan } from "@/lib/content-plan";

function revalidateMarketing(campaignId?: string) {
  revalidatePath("/marketing", "layout");
  revalidatePath("/calendar");
  if (campaignId) revalidatePath(`/marketing/campaigns/${campaignId}`);
}

export async function importContentPlan(plan: ContentPlan) {
  const user = await requirePermission("marketing", "create");
  const result = await importPlan(user, plan);
  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    entityType: "marketingCampaign",
    entityId: result.campaignId,
    action: "import",
    changes: { created: result.created, updated: result.updated, weeks: result.weeks },
  });
  revalidateMarketing(result.campaignId);
  return result;
}

const optInt = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).nullable());
const weekSchema = z.object({
  reach: optInt,
  saves: optInt,
  shares: optInt,
  newFollowers: optInt,
  bioClicks: optInt,
  newTeams: optInt,
  bestPost: z.string().trim().nullable().optional(),
  nextChange: z.string().trim().nullable().optional(),
});

export async function updateMarketingWeek(id: string, input: unknown) {
  const user = await requirePermission("marketing", "edit");
  const week = await prisma.marketingWeek.findFirst({ where: { id, campaign: { tenantId: user.tenantId } }, select: { campaignId: true } });
  if (!week) throw new ActionError("Týden nenalezen.");
  const data = weekSchema.parse(input);
  await prisma.marketingWeek.update({
    where: { id },
    data: { ...data, bestPost: data.bestPost || null, nextChange: data.nextChange || null },
  });
  revalidateMarketing(week.campaignId);
}

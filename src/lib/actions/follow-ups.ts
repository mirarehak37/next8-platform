"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit } from "@/lib/actions/helpers";
import { revalidatePath } from "next/cache";

const days = z.coerce.number().int().min(0).max(400);
const schemas = {
  lead_call: z.object({ days }),
  deal_onboarding: z.object({ days: z.array(days).min(1).max(6) }),
  deal_renewal: z.object({ daysBefore: days }),
} as const;

export async function saveFollowUpRule(key: string, isActive: boolean, config: unknown) {
  const user = await requirePermission("admin", "edit");
  if (!(key in schemas)) throw new Error("Neznámé pravidlo.");
  const parsed = schemas[key as keyof typeof schemas].parse(config);
  await prisma.followUpRule.upsert({
    where: { tenantId_key: { tenantId: user.tenantId, key } },
    create: { tenantId: user.tenantId, key, isActive, config: parsed },
    update: { isActive, config: parsed },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "followUpRule", entityId: key, action: "update", changes: { isActive, ...parsed } });
  revalidatePath("/admin/automation");
}

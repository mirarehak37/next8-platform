"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit } from "@/lib/actions/helpers";
import { activitySchema } from "@/lib/validations/crm";
import { revalidatePath } from "next/cache";
import { parseAppDateTime } from "@/lib/format";

export async function createActivity(data: unknown) {
  const user = await requirePermission("activity", "create");
  const parsed = activitySchema.parse(data);
  const activity = await prisma.activity.create({
    data: {
      ...parsed,
      activityAt: parsed.activityAt ? parseAppDateTime(parsed.activityAt) : new Date(),
      tenantId: user.tenantId,
      ownerId: user.id,
    },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "activity", entityId: activity.id, action: "create" });
  revalidatePath("/crm/activities");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  if (parsed.subjectType && parsed.subjectId) {
    revalidatePath(`/crm/${parsed.subjectType}s/${parsed.subjectId}`);
  }
  return activity;
}

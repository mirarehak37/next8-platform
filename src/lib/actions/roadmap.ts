"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, requireSession, logAudit, ActionError } from "@/lib/actions/helpers";
import { roadmapItemSchema } from "@/lib/validations/crm";
import { revalidatePath } from "next/cache";

export async function createRoadmapItem(data: unknown) {
  const user = await requirePermission("roadmap", "create");
  const parsed = roadmapItemSchema.parse(data);

  const item = await prisma.roadmapItem.create({
    data: { ...parsed, tenantId: user.tenantId, createdById: user.id },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "roadmap_item", entityId: item.id, action: "create" });
  revalidatePath("/roadmap");
  return item;
}

export async function updateRoadmapItem(id: string, data: unknown) {
  const user = await requirePermission("roadmap", "edit");
  const parsed = roadmapItemSchema.partial().parse(data);

  const existing = await prisma.roadmapItem.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Položka roadmapy nenalezena.");
  if (parsed.parentId === id) throw new ActionError("Položka nemůže být rodičem sama sobě.");

  const item = await prisma.roadmapItem.update({ where: { id }, data: parsed });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "roadmap_item", entityId: id, action: "update", changes: parsed });
  revalidatePath("/roadmap");
  return item;
}

// Drives both the Kanban drag&drop (status change) and manual reordering within a column.
export async function moveRoadmapItem(id: string, status: string, order?: number) {
  const user = await requirePermission("roadmap", "edit");
  const existing = await prisma.roadmapItem.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Položka roadmapy nenalezena.");

  const item = await prisma.roadmapItem.update({ where: { id }, data: { status, order } });
  if (existing.status !== status) {
    await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "roadmap_item", entityId: id, action: "status_change", changes: { status } });
  }
  revalidatePath("/roadmap");
  return item;
}

export async function voteRoadmapItem(id: string) {
  const user = await requireSession();
  const existing = await prisma.roadmapItem.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Položka roadmapy nenalezena.");
  const item = await prisma.roadmapItem.update({ where: { id }, data: { votes: { increment: 1 } } });
  revalidatePath("/roadmap");
  return item;
}

export async function deleteRoadmapItem(id: string) {
  const user = await requirePermission("roadmap", "delete");
  const existing = await prisma.roadmapItem.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Položka roadmapy nenalezena.");

  const childCount = await prisma.roadmapItem.count({ where: { parentId: id } });
  if (childCount > 0) throw new ActionError("Nejprve smažte nebo přesuňte podřízené položky.");

  await prisma.roadmapItem.delete({ where: { id } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "roadmap_item", entityId: id, action: "delete" });
  revalidatePath("/roadmap");
}

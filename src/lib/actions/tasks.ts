"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError } from "@/lib/actions/helpers";
import { taskSchema } from "@/lib/validations/crm";
import { revalidatePath } from "next/cache";

export async function createTask(data: unknown) {
  const user = await requirePermission("task", "create");
  const parsed = taskSchema.parse(data);
  const task = await prisma.task.create({
    data: { ...parsed, dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined, tenantId: user.tenantId, creatorId: user.id },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "task", entityId: task.id, action: "create" });
  revalidatePath("/tasks");
  return task;
}

export async function updateTask(id: string, data: unknown) {
  const user = await requirePermission("task", "edit");
  const parsed = taskSchema.partial().parse(data);
  const existing = await prisma.task.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Úkol nenalezen.");
  const task = await prisma.task.update({
    where: { id },
    data: { ...parsed, dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "task", entityId: id, action: "update", changes: parsed });
  revalidatePath("/tasks");
  return task;
}

export async function setTaskStatus(id: string, status: string) {
  const user = await requirePermission("task", "edit");
  const existing = await prisma.task.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Úkol nenalezen.");
  await prisma.task.update({ where: { id }, data: { status, completedAt: status === "done" ? new Date() : null } });
  revalidatePath("/tasks");
}

export async function toggleChecklistItem(itemId: string, isDone: boolean) {
  await requirePermission("task", "edit");
  await prisma.taskChecklistItem.update({ where: { id: itemId }, data: { isDone } });
  revalidatePath("/tasks");
}

export async function deleteTask(id: string) {
  const user = await requirePermission("task", "delete");
  const existing = await prisma.task.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Úkol nenalezen.");
  await prisma.task.delete({ where: { id } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "task", entityId: id, action: "delete" });
  revalidatePath("/tasks");
}

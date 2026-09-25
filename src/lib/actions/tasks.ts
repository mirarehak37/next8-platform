"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError, onlyProvided } from "@/lib/actions/helpers";
import { taskSchema } from "@/lib/validations/crm";
import { revalidatePath } from "next/cache";

function revalidateTasks() {
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function createTask(data: unknown) {
  const user = await requirePermission("task", "create");
  const parsed = taskSchema.parse(data);
  const task = await prisma.task.create({
    data: {
      ...parsed,
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
      completedAt: parsed.status === "done" ? new Date() : null,
      tenantId: user.tenantId,
      creatorId: user.id,
    },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "task", entityId: task.id, action: "create" });
  revalidateTasks();
  return task;
}

export async function updateTask(id: string, data: unknown) {
  const user = await requirePermission("task", "edit");
  const parsed = onlyProvided(taskSchema.partial().parse(data), data);
  const existing = await prisma.task.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Úkol nenalezen.");
  const { dueDate, ...rest } = parsed;
  const task = await prisma.task.update({
    where: { id },
    data: {
      ...rest,
      // An emptied date field clears the deadline instead of silently keeping the old one.
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      ...(parsed.status && parsed.status !== existing.status ? { completedAt: parsed.status === "done" ? new Date() : null } : {}),
    },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "task", entityId: id, action: "update", changes: parsed });
  revalidateTasks();
  return task;
}

export async function setTaskStatus(id: string, status: string) {
  const user = await requirePermission("task", "edit");
  const existing = await prisma.task.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Úkol nenalezen.");
  await prisma.task.update({ where: { id }, data: { status, completedAt: status === "done" ? new Date() : null } });
  revalidateTasks();
}

export async function toggleChecklistItem(itemId: string, isDone: boolean) {
  await requirePermission("task", "edit");
  await prisma.taskChecklistItem.update({ where: { id: itemId }, data: { isDone } });
  revalidateTasks();
}

export async function deleteTask(id: string) {
  const user = await requirePermission("task", "delete");
  const existing = await prisma.task.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Úkol nenalezen.");
  await prisma.task.delete({ where: { id } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "task", entityId: id, action: "delete" });
  revalidateTasks();
}

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can, type ModuleResource, type PermissionAction } from "@/lib/rbac";

export class ActionError extends Error {}

export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new ActionError("Nepřihlášeno.");
  return session.user;
}

export async function requirePermission(resource: ModuleResource, action: PermissionAction) {
  const user = await requireSession();
  if (!can(user.role, resource, action)) {
    throw new ActionError("Nemáte oprávnění k této akci.");
  }
  return user;
}

export async function logAudit(params: {
  tenantId: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  changes?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      changes: params.changes ? JSON.stringify(params.changes) : undefined,
    },
  });
}

// Zod's .partial() still fills in .default() values, so a partial update like
// { status: "attended" } would also reset every defaulted field (paymentStatus,
// quantity…). Keep only the keys the caller actually sent.
export function onlyProvided<T extends object>(parsed: T, input: unknown): Partial<T> {
  if (!input || typeof input !== "object") return {};
  const sent = new Set(Object.keys(input));
  return Object.fromEntries(Object.entries(parsed).filter(([k]) => sent.has(k))) as Partial<T>;
}

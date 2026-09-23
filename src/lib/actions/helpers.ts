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

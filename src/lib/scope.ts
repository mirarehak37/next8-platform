import { prisma } from "@/lib/prisma";
import { scopeFor, type ModuleResource } from "@/lib/rbac";

export type SessionUser = { id: string; tenantId: string; role: string };

// Resolves a record-visibility scope (own/team/all) into a Prisma `where` fragment.
// "team" scope is approximated via the user's team memberships' fellow members —
// good enough for the demo; a real deployment would cache this per request.
export async function ownerScopeWhere(user: SessionUser, resource: ModuleResource, ownerField = "ownerId") {
  const scope = scopeFor(user.role, resource) ?? "own";
  if (scope === "all") return { tenantId: user.tenantId };
  if (scope === "own") return { tenantId: user.tenantId, [ownerField]: user.id };

  const memberships = await prisma.teamMember.findMany({ where: { userId: user.id }, select: { teamId: true } });
  const teamIds = memberships.map((m) => m.teamId);
  if (teamIds.length === 0) return { tenantId: user.tenantId, [ownerField]: user.id };

  const teammates = await prisma.teamMember.findMany({ where: { teamId: { in: teamIds } }, select: { userId: true } });
  const userIds = Array.from(new Set(teammates.map((t) => t.userId)));
  return { tenantId: user.tenantId, [ownerField]: { in: userIds } };
}

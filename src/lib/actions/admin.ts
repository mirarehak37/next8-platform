"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError } from "@/lib/actions/helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const userSchema = z.object({
  name: z.string().min(1, "Jméno je povinné"),
  email: z.string().email("Neplatný e-mail"),
  jobTitle: z.string().optional().nullable(),
  roleId: z.string().min(1, "Role je povinná"),
});

export async function createUser(data: unknown) {
  const user = await requirePermission("admin", "admin");
  const parsed = userSchema.parse(data);

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const newUser = await prisma.user.create({
    data: { tenantId: user.tenantId, name: parsed.name, email: parsed.email, jobTitle: parsed.jobTitle, passwordHash, status: "invited" },
  });
  await prisma.userRole.create({ data: { userId: newUser.id, roleId: parsed.roleId } });

  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "user", entityId: newUser.id, action: "create" });
  revalidatePath("/admin/users");
  return newUser;
}

export async function setUserStatus(id: string, status: string) {
  const user = await requirePermission("admin", "admin");
  await prisma.user.update({ where: { id, tenantId: user.tenantId }, data: { status } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "user", entityId: id, action: "status_change", changes: { status } });
  revalidatePath("/admin/users");
}

export async function setUserRole(userId: string, roleId: string) {
  const admin = await requirePermission("admin", "admin");
  await prisma.userRole.deleteMany({ where: { userId } });
  await prisma.userRole.create({ data: { userId, roleId } });
  await logAudit({ tenantId: admin.tenantId, userId: admin.id, entityType: "user", entityId: userId, action: "update", changes: { roleId } });
  revalidatePath("/admin/users");
}

const teamSchema = z.object({ name: z.string().min(1), description: z.string().optional().nullable() });

export async function createTeam(data: unknown) {
  const user = await requirePermission("admin", "admin");
  const parsed = teamSchema.parse(data);
  const team = await prisma.team.create({ data: { ...parsed, tenantId: user.tenantId } });
  revalidatePath("/admin/teams");
  return team;
}

export async function addTeamMember(teamId: string, userId: string) {
  await requirePermission("admin", "admin");
  await prisma.teamMember.create({ data: { teamId, userId } });
  revalidatePath("/admin/teams");
}

export async function removeTeamMember(memberId: string) {
  await requirePermission("admin", "admin");
  await prisma.teamMember.delete({ where: { id: memberId } });
  revalidatePath("/admin/teams");
}

export async function toggleTenantModule(moduleId: string, enabled: boolean) {
  const user = await requirePermission("admin", "admin");
  const tenantModule = await prisma.tenantModule.findUnique({ where: { tenantId_moduleId: { tenantId: user.tenantId, moduleId } } });
  if (!tenantModule) throw new ActionError("Modul nenalezen.");
  await prisma.tenantModule.update({ where: { id: tenantModule.id }, data: { enabled } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "module", entityId: moduleId, action: enabled ? "enable" : "disable" });
  revalidatePath("/admin/modules");
}

const customFieldSchema = z.object({
  entityType: z.string().min(1),
  key: z.string().min(1).regex(/^[a-z0-9_]+$/, "Pouze malá písmena, čísla a podtržítka"),
  label: z.string().min(1),
  fieldType: z.string().min(1),
  options: z.string().optional().nullable(),
  isRequired: z.boolean().default(false),
});

export async function createCustomField(data: unknown) {
  const user = await requirePermission("admin", "admin");
  const parsed = customFieldSchema.parse(data);
  const field = await prisma.customFieldDefinition.create({ data: { ...parsed, tenantId: user.tenantId } });
  revalidatePath("/admin/custom-fields");
  return field;
}

export async function deleteCustomField(id: string) {
  const user = await requirePermission("admin", "admin");
  const existing = await prisma.customFieldDefinition.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Pole nenalezeno.");
  await prisma.customFieldDefinition.delete({ where: { id } });
  revalidatePath("/admin/custom-fields");
}

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, logAudit, ActionError } from "@/lib/actions/helpers";
import { revalidatePath } from "next/cache";

const clubTeamSchema = z.object({
  companyId: z.string().min(1),
  category: z.string().min(1, "Kategorie je povinná"),
  name: z.string().min(1, "Název týmu je povinný"),
  league: z.string().optional().nullable(),
});
export type ClubTeamInput = z.input<typeof clubTeamSchema>;

export async function createClubTeam(data: unknown) {
  const user = await requirePermission("company", "edit");
  const parsed = clubTeamSchema.parse(data);

  const company = await prisma.company.findFirst({ where: { id: parsed.companyId, tenantId: user.tenantId } });
  if (!company) throw new ActionError("Klub nenalezen.");

  const team = await prisma.clubTeam.create({ data: { ...parsed, tenantId: user.tenantId } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "clubTeam", entityId: team.id, action: "create" });
  revalidatePath(`/crm/companies/${parsed.companyId}`);
  return team;
}

export async function updateClubTeam(id: string, data: unknown) {
  const user = await requirePermission("company", "edit");
  const parsed = clubTeamSchema.partial().parse(data);

  const existing = await prisma.clubTeam.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Tým nenalezen.");

  const team = await prisma.clubTeam.update({ where: { id }, data: parsed });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "clubTeam", entityId: id, action: "update", changes: parsed });
  revalidatePath(`/crm/companies/${existing.companyId}`);
  return team;
}

export async function deleteClubTeam(id: string) {
  const user = await requirePermission("company", "edit");
  const existing = await prisma.clubTeam.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) throw new ActionError("Tým nenalezen.");

  await prisma.clubTeam.delete({ where: { id } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "clubTeam", entityId: id, action: "delete" });
  revalidatePath(`/crm/companies/${existing.companyId}`);
}

export async function addClubTeamContact(clubTeamId: string, contactId: string, role?: string | null) {
  const user = await requirePermission("company", "edit");
  const team = await prisma.clubTeam.findFirst({ where: { id: clubTeamId, tenantId: user.tenantId } });
  if (!team) throw new ActionError("Tým nenalezen.");

  const link = await prisma.clubTeamContact.upsert({
    where: { clubTeamId_contactId: { clubTeamId, contactId } },
    create: { clubTeamId, contactId, role: role || undefined },
    update: { role: role || undefined },
  });
  revalidatePath(`/crm/companies/${team.companyId}`);
  return link;
}

export async function removeClubTeamContact(clubTeamId: string, contactId: string) {
  const user = await requirePermission("company", "edit");
  const team = await prisma.clubTeam.findFirst({ where: { id: clubTeamId, tenantId: user.tenantId } });
  if (!team) throw new ActionError("Tým nenalezen.");

  await prisma.clubTeamContact.delete({ where: { clubTeamId_contactId: { clubTeamId, contactId } } });
  revalidatePath(`/crm/companies/${team.companyId}`);
}

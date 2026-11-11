"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ActionError, logAudit, requireSession } from "@/lib/actions/helpers";
import { generateToken } from "@/lib/api-tokens";

export async function createApiToken(name: string) {
  const user = await requireSession();
  const label = name.trim().slice(0, 60) || "Claude";
  const active = await prisma.apiToken.count({ where: { userId: user.id, revokedAt: null } });
  if (active >= 10) throw new ActionError("Máte maximum 10 aktivních tokenů. Nějaký nejdřív zrušte.");

  const { token, hash, prefix } = generateToken();
  const record = await prisma.apiToken.create({
    data: { tenantId: user.tenantId, userId: user.id, name: label, tokenHash: hash, prefix },
  });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "api_token", entityId: record.id, action: "create" });
  revalidatePath("/settings/claude");
  return { token };
}

export async function revokeApiToken(id: string) {
  const user = await requireSession();
  const record = await prisma.apiToken.findFirst({ where: { id, userId: user.id, revokedAt: null } });
  if (!record) throw new ActionError("Token nenalezen.");
  await prisma.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
  await logAudit({ tenantId: user.tenantId, userId: user.id, entityType: "api_token", entityId: id, action: "revoke" });
  revalidatePath("/settings/claude");
}

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const TOKEN_PREFIX = "n8_";

export type TokenUser = { id: string; tenantId: string; role: string; name: string };

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken() {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token), prefix: token.slice(0, 10) };
}

export async function userFromBearer(header: string | null): Promise<TokenUser | null> {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  if (!match || !match[1].startsWith(TOKEN_PREFIX)) return null;

  const record = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(match[1]) },
    include: { user: { include: { userRoles: { include: { role: true } } } } },
  });
  if (!record || record.revokedAt || record.user.status !== "active") return null;

  if (!record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > 5 * 60 * 1000) {
    await prisma.apiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  }

  return {
    id: record.user.id,
    tenantId: record.tenantId,
    role: record.user.userRoles[0]?.role.name ?? "Read Only",
    name: record.user.name,
  };
}

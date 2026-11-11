import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ClaudeConnect } from "./claude-connect";

export default async function ClaudeSettingsPage() {
  const session = await auth();
  const user = session!.user;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const mcpUrl = `${proto}://${host}/api/mcp`;

  const tokens = await prisma.apiToken.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true },
  });

  return (
    <div>
      <PageHeader
        title="Připojení ke Claude"
        description="Napojte CRM na Clauda přes MCP. Claude pak umí ovládat celé CRM — číst, zakládat a upravovat kluby, kontakty, obchody, úkoly, marketing i další moduly — s vašimi oprávněními."
        breadcrumbs={[{ label: "Nastavení" }, { label: "Připojení ke Claude" }]}
      />
      <ClaudeConnect
        mcpUrl={mcpUrl}
        tokens={tokens.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
          lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}

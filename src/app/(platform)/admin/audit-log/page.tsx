import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";

const ENTITY_LABELS: Record<string, string> = {
  company: "Firma", contact: "Kontakt", lead: "Lead", deal: "Obchodní případ", quote: "Nabídka",
  product: "Produkt", task: "Úkol", activity: "Aktivita", user: "Uživatel", module: "Modul",
};
const ACTION_META: Record<string, { label: string; color: string }> = {
  create: { label: "Vytvořeno", color: "emerald" },
  update: { label: "Upraveno", color: "sky" },
  delete: { label: "Smazáno", color: "rose" },
  status_change: { label: "Změna stavu", color: "amber" },
  convert: { label: "Převedeno", color: "indigo" },
  enable: { label: "Aktivováno", color: "emerald" },
  disable: { label: "Deaktivováno", color: "slate" },
};

export default async function AuditLogPage() {
  const session = await auth();
  const user = session!.user;

  const logs = await prisma.auditLog.findMany({
    where: { tenantId: user.tenantId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader title="Audit log" description={`Posledních ${logs.length} změn v systému`} breadcrumbs={[{ label: "Administrace" }, { label: "Audit log" }]} />
      <div className="p-6">
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Datum a čas</TableHead>
                <TableHead>Uživatel</TableHead>
                <TableHead>Entita</TableHead>
                <TableHead>Akce</TableHead>
                <TableHead>ID záznamu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground h-24">Zatím žádná historie.</TableCell></TableRow>}
              {logs.map((log) => {
                const meta = ACTION_META[log.action] ?? { label: log.action, color: "slate" };
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDateTime(log.createdAt)}</TableCell>
                    <TableCell className="text-sm">{log.user?.name ?? "Systém"}</TableCell>
                    <TableCell className="text-sm">{ENTITY_LABELS[log.entityType] ?? log.entityType}</TableCell>
                    <TableCell><StatusBadge label={meta.label} color={meta.color} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{log.entityId.slice(0, 12)}…</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

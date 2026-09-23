import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Workflow, ArrowRight } from "lucide-react";

const TRIGGER_LABELS: Record<string, string> = {
  on_create: "Při vytvoření záznamu", on_update: "Při změně záznamu", on_status_change: "Při změně stavu/fáze",
  time_based: "Časově řízené", manual: "Ruční spuštění",
};

export default async function AutomationPage() {
  const session = await auth();
  const user = session!.user;

  const rules = await prisma.workflowRule.findMany({ where: { tenantId: user.tenantId }, orderBy: { createdAt: "desc" } });
  const creators = await prisma.user.findMany({ where: { id: { in: rules.map((r) => r.createdById) } }, select: { id: true, name: true } });
  const creatorNames = new Map(creators.map((c) => [c.id, c.name]));

  return (
    <div>
      <PageHeader
        title="Automatizace"
        description="Obecný workflow engine platformy: TRIGGER → PODMÍNKA → AKCE. Konfigurace níže je uložena strukturovaně a stejný engine budou moci využívat i budoucí moduly (Faktury, Schvalování, HR…)."
        breadcrumbs={[{ label: "Administrace" }, { label: "Automatizace" }]}
      />
      <div className="p-6 space-y-4">
        {rules.length === 0 && <p className="text-sm text-muted-foreground">Zatím žádná pravidla.</p>}
        {rules.map((rule) => {
          const trigger = JSON.parse(rule.triggerConfig);
          const actions = JSON.parse(rule.actions) as { type: string; title?: string; dueInDays?: number }[];
          return (
            <Card key={rule.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FF1947]/10 text-[#FF1947] dark:bg-[#FF1947]/10">
                    <Workflow className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{rule.name}</CardTitle>
                    <CardDescription>{rule.description}</CardDescription>
                  </div>
                </div>
                <StatusBadge label={rule.isActive ? "Aktivní" : "Neaktivní"} color={rule.isActive ? "emerald" : "slate"} />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="rounded-md bg-muted px-2.5 py-1.5 font-medium">{TRIGGER_LABELS[rule.triggerType] ?? rule.triggerType}</span>
                  {trigger.field && <span className="text-muted-foreground">({trigger.field} → {trigger.to})</span>}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  {actions.map((a, i) => (
                    <span key={i} className="rounded-md bg-[#FF1947]/10 dark:bg-[#FF1947]/10 text-[#FF1947] dark:text-[#FF1947] px-2.5 py-1.5">
                      {a.type === "create_task" ? `Vytvořit úkol: „${a.title}“ (do ${a.dueInDays} dní)` : a.type}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mt-3">Vytvořil: {creatorNames.get(rule.createdById) ?? "—"}</div>
              </CardContent>
            </Card>
          );
        })}

        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Vizuální builder pravidel (drag&drop TRIGGER → PODMÍNKA → AKCE) je dalším krokem rozvoje platformy.
            Datový model (<code className="text-xs">WorkflowRule</code>, <code className="text-xs">WorkflowRun</code>) je již připraven a stejný engine bude sdílet CRM i budoucí moduly.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

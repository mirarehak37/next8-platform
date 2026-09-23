import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ownerScopeWhere } from "@/lib/scope";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DealFormDialog } from "@/components/crm/deal-form-dialog";
import { DealsKanban, type KanbanDeal, type KanbanStage } from "./deals-kanban";
import { DealsTable, type DealRow } from "./deals-table";

export default async function DealsPage() {
  const session = await auth();
  const user = session!.user;

  const scope = await ownerScopeWhere(user, "deal");
  const [pipeline, deals, owners, companies, contacts] = await Promise.all([
    prisma.pipeline.findFirst({ where: { tenantId: user.tenantId, isDefault: true }, include: { stages: { orderBy: { order: "asc" } } } }),
    prisma.deal.findMany({
      where: scope,
      include: { stage: true, company: { select: { name: true } }, owner: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { tenantId: user.tenantId }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: "asc" } }),
  ]);
  const contactOptions = contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }));

  if (!pipeline) return null;

  const stages: KanbanStage[] = pipeline.stages.map((s) => ({ id: s.id, name: s.name, probability: s.probability, isWon: s.isWon, isLost: s.isLost }));

  const kanbanDeals: KanbanDeal[] = deals
    .filter((d) => d.status === "open")
    .map((d) => ({
      id: d.id,
      name: d.name,
      value: d.value,
      currency: d.currency,
      companyName: d.company?.name ?? null,
      ownerName: d.owner.name,
      stageId: d.stageId,
      expectedCloseDate: d.expectedCloseDate?.toISOString() ?? null,
    }));

  const tableRows: DealRow[] = deals.map((d) => ({
    id: d.id,
    name: d.name,
    companyName: d.company?.name ?? null,
    stageName: d.stage.name,
    value: d.value,
    currency: d.currency,
    status: d.status,
    probability: d.probability,
    expectedCloseDate: d.expectedCloseDate?.toISOString() ?? null,
    ownerName: d.owner.name,
  }));

  const openValue = kanbanDeals.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      <PageHeader
        title="Obchodní případy"
        description={`${kanbanDeals.length} otevřených obchodů v hodnotě ${new Intl.NumberFormat("cs-CZ").format(openValue)} Kč`}
        breadcrumbs={[{ label: "CRM" }, { label: "Obchodní případy" }]}
        actions={<DealFormDialog owners={owners} companies={companies} contacts={contactOptions} stages={stages} pipelineId={pipeline.id} />}
      />
      <div className="p-6">
        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="list">Seznam</TabsTrigger>
          </TabsList>
          <TabsContent value="kanban" className="pt-4">
            <DealsKanban stages={stages} deals={kanbanDeals} owners={owners} companies={companies} contacts={contactOptions} pipelineId={pipeline.id} />
          </TabsContent>
          <TabsContent value="list" className="pt-4">
            <DealsTable data={tableRows} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

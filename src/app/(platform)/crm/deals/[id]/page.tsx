import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DealFormDialog, DealEditTrigger } from "@/components/crm/deal-form-dialog";
import { Building2, Handshake, FileText, Package } from "lucide-react";
import { DEAL_STATUSES, findMeta, ACTIVITY_TYPES } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime, initials } from "@/lib/format";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = session!.user;

  const deal = await prisma.deal.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      owner: true,
      company: true,
      stage: true,
      pipeline: { include: { stages: { orderBy: { order: "asc" } } } },
      contacts: { include: { contact: true } },
      products: true,
      quotes: true,
    },
  });
  if (!deal) notFound();

  const [activities, owners, companies, contacts] = await Promise.all([
    prisma.activity.findMany({
      where: { tenantId: user.tenantId, subjectType: "deal", subjectId: id },
      include: { owner: { select: { name: true } } },
      orderBy: { activityAt: "desc" },
    }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { tenantId: user.tenantId }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: "asc" } }),
  ]);
  const contactOptions = contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }));

  const statusMeta = findMeta(DEAL_STATUSES, deal.status);
  const stages = deal.pipeline.stages.filter((s) => !s.isWon && !s.isLost);
  const currentStageIndex = stages.findIndex((s) => s.id === deal.stageId);

  return (
    <div>
      <PageHeader
        title={deal.name}
        breadcrumbs={[{ label: "CRM" }, { label: "Obchodní případy", href: "/crm/deals" }, { label: deal.name }]}
        actions={
          <DealFormDialog
            owners={owners}
            companies={companies}
            contacts={contactOptions}
            stages={deal.pipeline.stages}
            pipelineId={deal.pipelineId}
            deal={{
              id: deal.id,
              name: deal.name,
              companyId: deal.companyId,
              primaryContactId: deal.primaryContactId,
              ownerId: deal.ownerId,
              pipelineId: deal.pipelineId,
              stageId: deal.stageId,
              value: deal.value,
              expectedCloseDate: deal.expectedCloseDate?.toISOString().slice(0, 10),
              source: deal.source,
              nextStep: deal.nextStep,
              nextStepDate: deal.nextStepDate?.toISOString().slice(0, 10),
              description: deal.description,
            }}
            trigger={<DealEditTrigger />}
          />
        }
      />

      <div className="p-6 space-y-6">
        {deal.status === "open" && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {stages.map((stage, i) => (
              <div key={stage.id} className={`flex-1 min-w-[100px] text-center py-2 text-xs font-medium rounded-md border ${i <= currentStageIndex ? "bg-[#FF1947] text-white border-[#FF1947]" : "bg-muted text-muted-foreground"}`}>
                {stage.name}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="lg:col-span-3">
            <CardContent className="flex flex-wrap items-start gap-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#FF1947]/10 text-[#FF1947] dark:bg-[#FF1947]/10 shrink-0">
                <Handshake className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-[200px] space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold">{formatCurrency(deal.value, deal.currency)}</h2>
                  {statusMeta && <StatusBadge label={statusMeta.label} color={statusMeta.color} />}
                  <span className="text-sm text-muted-foreground">{deal.stage.name} · {deal.probability ?? deal.stage.probability}% pravděpodobnost</span>
                </div>
                {deal.company && (
                  <Link href={`/crm/companies/${deal.company.id}`} className="flex items-center gap-1.5 text-sm text-[#FF1947] hover:underline w-fit">
                    <Building2 className="h-3.5 w-3.5" /> {deal.company.name}
                  </Link>
                )}
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                  {deal.expectedCloseDate && <span>Očekávané uzavření: {formatDate(deal.expectedCloseDate)}</span>}
                  {deal.source && <span>Zdroj: {deal.source}</span>}
                </div>
                {deal.nextStep && (
                  <div className="text-sm bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 rounded-md px-2.5 py-1.5 w-fit">
                    Další krok: {deal.nextStep} {deal.nextStepDate && `(${formatDate(deal.nextStepDate)})`}
                  </div>
                )}
                {deal.status === "lost" && deal.lossReason && (
                  <div className="text-sm bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 rounded-md px-2.5 py-1.5 w-fit">
                    Důvod prohry: {deal.lossReason} {deal.competitor && `· Konkurence: ${deal.competitor}`}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8"><AvatarFallback className="text-xs bg-[#FF1947] text-white">{initials(deal.owner.name)}</AvatarFallback></Avatar>
                <div>
                  <div className="text-xs text-muted-foreground">Vlastník</div>
                  <div className="text-sm font-medium">{deal.owner.name}</div>
                </div>
              </div>
              {deal.contacts.length > 0 && (
                <div className="pt-2 border-t">
                  <div className="text-xs text-muted-foreground mb-1">Kontaktní osoby</div>
                  {deal.contacts.map((dc) => (
                    <Link key={dc.id} href={`/crm/contacts/${dc.contact.id}`} className="text-sm text-[#FF1947] hover:underline block">
                      {dc.contact.firstName} {dc.contact.lastName}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="products">
          <TabsList variant="line">
            <TabsTrigger value="products">Produkty ({deal.products.length})</TabsTrigger>
            <TabsTrigger value="quotes">Nabídky ({deal.quotes.length})</TabsTrigger>
            <TabsTrigger value="activities">Aktivity ({activities.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="pt-4 space-y-2">
            {deal.products.length === 0 && <EmptyState text="Zatím žádné produkty." />}
            {deal.products.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.quantity}× {formatCurrency(p.unitPrice)}</div>
                    </div>
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(p.total)}</span>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="quotes" className="pt-4 space-y-2">
            {deal.quotes.length === 0 && <EmptyState text="Zatím žádné nabídky." />}
            {deal.quotes.map((q) => (
              <Link key={q.id} href={`/crm/quotes/${q.id}`}>
                <Card className="hover:bg-muted/40 transition-colors">
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{q.number}</span>
                    </div>
                    <span className="text-sm">{formatCurrency(q.total, q.currency)}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </TabsContent>

          <TabsContent value="activities" className="pt-4 space-y-2">
            {activities.length === 0 && <EmptyState text="Zatím žádné aktivity." />}
            {activities.map((a) => {
              const meta = findMeta(ACTIVITY_TYPES, a.type);
              return (
                <Card key={a.id}>
                  <CardContent className="flex items-start gap-3 py-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground mt-0.5 text-[10px] font-medium">
                      {meta?.label.slice(0, 2) ?? "•"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{a.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1">{a.owner.name} · {formatDateTime(a.activityAt)}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground border rounded-md border-dashed">{text}</div>;
}

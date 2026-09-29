import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecordEditTrigger } from "@/components/partnerships/form-parts";
import { WebFormDialog } from "@/components/web-forms/web-form-dialog";
import { ShareSnippets } from "@/components/web-forms/share-snippets";
import { LEAD_STATUSES, findMeta } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export default async function WebFormsPage() {
  const session = await auth();
  const user = session!.user;
  if (!can(user.role, "marketing", "view")) redirect("/dashboard");

  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const [forms, owners, campaigns] = await Promise.all([
    prisma.webForm.findMany({
      where: { tenantId: user.tenantId },
      include: {
        owner: { select: { name: true } },
        leads: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, firstName: true, lastName: true, companyName: true, status: true, campaign: true, createdAt: true } },
        _count: { select: { leads: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.marketingCampaign.findMany({ where: { tenantId: user.tenantId }, select: { name: true, utmCampaign: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const recent = await prisma.lead.groupBy({ by: ["webFormId"], where: { tenantId: user.tenantId, webFormId: { not: null }, createdAt: { gte: monthAgo } }, _count: { _all: true } });
  const recentBy = new Map(recent.map((r) => [r.webFormId, r._count._all]));
  const campaignOptions = campaigns.map((c) => ({ value: c.utmCampaign || c.name, label: c.name }));
  const canEdit = can(user.role, "marketing", "edit");

  return (
    <div>
      <PageHeader
        title="Webové formuláře"
        description="Poptávky z webu a Instagramu padají rovnou do Leadů – s kampaní a úkolem zavolat"
        breadcrumbs={[{ label: "Marketing", href: "/marketing" }, { label: "Webové formuláře" }]}
        actions={can(user.role, "marketing", "create") ? <WebFormDialog owners={owners} campaigns={campaignOptions} currentUserId={user.id} /> : null}
      />
      <div className="p-6 space-y-4">
        {forms.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground border rounded-md border-dashed">
            Zatím žádný formulář. Vytvořte ho a odkaz dejte do bia na Instagramu nebo kód vložte na web.
          </div>
        )}
        {forms.map((f) => (
          <Card key={f.id}>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {f.name}
                  <StatusBadge label={f.isActive ? "Aktivní" : "Vypnutý"} color={f.isActive ? "emerald" : "slate"} />
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {f._count.leads} leadů celkem · {recentBy.get(f.id) ?? 0} za 30 dní · přiděluje se: {f.owner.name}
                  {f.campaign && ` · kampaň: ${f.campaign}`}
                </p>
              </div>
              {canEdit && (
                <WebFormDialog
                  form={{ id: f.id, name: f.name, headline: f.headline, intro: f.intro, thankYou: f.thankYou, source: f.source, campaign: f.campaign, ownerId: f.ownerId, isActive: f.isActive }}
                  owners={owners}
                  campaigns={campaignOptions}
                  currentUserId={user.id}
                  canDelete={can(user.role, "marketing", "delete")}
                  trigger={<RecordEditTrigger />}
                />
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sdílení</div>
                <ShareSnippets formId={f.id} />
                <p className="text-xs text-muted-foreground">Na konec odkazu přidejte <code>&utm_campaign=…</code> a leady se přiřadí ke kampani. Pro ambasadora <code>&ref=jmeno</code>.</p>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Poslední leady</div>
                {f.leads.length === 0 && <p className="text-sm text-muted-foreground py-2">Zatím nic nepřišlo.</p>}
                {f.leads.map((l) => {
                  const st = findMeta(LEAD_STATUSES, l.status);
                  return (
                    <div key={l.id} className="flex items-center justify-between gap-2 border-b last:border-0 py-1.5 text-sm">
                      <span className="truncate">{[l.firstName, l.lastName].filter(Boolean).join(" ")}{l.companyName && <span className="text-muted-foreground"> · {l.companyName}</span>}</span>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <span className="text-xs text-muted-foreground">{formatDateTime(l.createdAt)}</span>
                        {st && <StatusBadge label={st.label} color={st.color} />}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecordEditTrigger } from "@/components/partnerships/form-parts";
import { CampaignFormDialog } from "@/components/marketing/campaign-form-dialog";
import { PostFormDialog } from "@/components/marketing/post-form-dialog";
import { ContentBoard } from "@/components/marketing/content-board";
import { UtmBuilder } from "@/components/marketing/utm-builder";
import { CAMPAIGN_STATUSES, LEAD_STATUSES, MARKETING_AUDIENCES, MARKETING_CHANNELS, findMeta } from "@/lib/constants";
import { engagementRate, formatPercent, slugify } from "@/lib/marketing";
import { campaignLeadWhere, loadPostFormOptions, postInclude, toPostView } from "@/lib/marketing-queries";
import { formatCurrency, formatDate } from "@/lib/format";
import { Banknote, Eye, Heart, Plus, Trophy, UserPlus, Wallet } from "lucide-react";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = session!.user;
  if (!can(user.role, "marketing", "view")) redirect("/dashboard");

  const c = await prisma.marketingCampaign.findFirst({ where: { id, tenantId: user.tenantId }, include: { owner: { select: { name: true } } } });
  if (!c) notFound();

  const leadWhere = campaignLeadWhere(user.tenantId, c);
  const [posts, leads, leadCount, converted, options] = await Promise.all([
    prisma.marketingPost.findMany({ where: { campaignId: c.id }, include: postInclude, orderBy: { scheduledAt: { sort: "asc", nulls: "last" } } }),
    prisma.lead.findMany({ where: leadWhere, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, firstName: true, lastName: true, companyName: true, status: true, source: true, createdAt: true } }),
    prisma.lead.count({ where: leadWhere }),
    prisma.lead.findMany({ where: { ...leadWhere, status: "converted", convertedDealId: { not: null } }, select: { convertedDealId: true } }),
    loadPostFormOptions(user.tenantId),
  ]);
  const wonDeals = converted.length
    ? await prisma.deal.aggregate({ where: { id: { in: converted.map((l) => l.convertedDealId!) }, status: "won" }, _sum: { value: true }, _count: true })
    : null;
  const revenue = wonDeals?._sum.value ?? 0;

  // Finished campaigns are hidden from the picker; keep this one selectable on its own page.
  if (!options.campaigns.some((x) => x.id === c.id)) options.campaigns.unshift({ id: c.id, name: c.name });

  const published = posts.filter((p) => p.status === "published");
  const reach = published.reduce((s, p) => s + (p.reach ?? 0), 0);
  const rates = published.map(engagementRate).filter((r): r is number => r != null);
  const avgEr = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  const cpl = c.spent && leadCount ? c.spent / leadCount : null;
  const roas = c.spent && revenue ? revenue / c.spent : null;
  const st = findMeta(CAMPAIGN_STATUSES, c.status);
  const aud = findMeta(MARKETING_AUDIENCES, c.audience);
  const canEdit = can(user.role, "marketing", "edit");
  const utm = c.utmCampaign || slugify(c.name);

  return (
    <div>
      <PageHeader
        title={c.name}
        description={[st?.label, aud?.label, c.startDate || c.endDate ? `${formatDate(c.startDate)} – ${formatDate(c.endDate)}` : null].filter(Boolean).join(" · ")}
        breadcrumbs={[{ label: "Marketing", href: "/marketing" }, { label: "Kampaně", href: "/marketing/campaigns" }, { label: c.name }]}
        actions={
          <div className="flex gap-2">
            {can(user.role, "marketing", "create") && (
              <PostFormDialog options={options} currentUserId={user.id} defaults={{ campaignId: c.id, audience: c.audience }} trigger={<Button size="sm" variant="outline"><Plus className="h-4 w-4" /> Příspěvek</Button>} />
            )}
            {canEdit && (
              <CampaignFormDialog
                campaign={{
                  id: c.id, name: c.name, goal: c.goal, audience: c.audience, channels: c.channels, status: c.status,
                  startDate: c.startDate?.toISOString().slice(0, 10) ?? null, endDate: c.endDate?.toISOString().slice(0, 10) ?? null,
                  budget: c.budget, spent: c.spent, utmCampaign: c.utmCampaign, targetLeads: c.targetLeads, description: c.description, ownerId: c.ownerId,
                }}
                owners={options.owners}
                canDelete={can(user.role, "marketing", "delete")}
                trigger={<RecordEditTrigger />}
              />
            )}
          </div>
        }
      />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard label="Leady" value={`${leadCount}${c.targetLeads ? ` / ${c.targetLeads}` : ""}`} icon={UserPlus} hint={c.targetLeads ? `${Math.round((leadCount / c.targetLeads) * 100)} % cíle` : undefined} />
          <KpiCard label="Cena za lead" value={cpl != null ? formatCurrency(cpl) : "—"} icon={Wallet} />
          <KpiCard label="Utraceno" value={formatCurrency(c.spent ?? 0)} icon={Banknote} hint={c.budget ? `z rozpočtu ${formatCurrency(c.budget)}` : undefined} />
          <KpiCard label="Vyhrané obchody" value={formatCurrency(revenue)} icon={Trophy} hint={roas != null ? `návratnost ${roas.toFixed(1)}×` : `${wonDeals?._count ?? 0} obchodů`} />
          <KpiCard label="Dosah" value={reach.toLocaleString("cs-CZ")} icon={Eye} hint={`${published.length} publikovaných z ${posts.length}`} />
          <KpiCard label="Průměrný engagement" value={formatPercent(avgEr)} icon={Heart} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Odkaz s UTM parametry</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">Dávejte tento odkaz do bia, reklam a newsletteru. Leady s kampaní <code className="rounded bg-muted px-1">{utm}</code> se sem započítají.</p>
              <UtmBuilder campaign={utm} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">O kampani</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {c.goal && <div><div className="text-xs text-muted-foreground">Cíl</div>{c.goal}</div>}
              {c.channels.length > 0 && <div><div className="text-xs text-muted-foreground">Kanály</div>{c.channels.map((x) => findMeta(MARKETING_CHANNELS, x)?.label ?? x).join(", ")}</div>}
              <div><div className="text-xs text-muted-foreground">Vlastník</div>{c.owner.name}</div>
              {c.description && <div><div className="text-xs text-muted-foreground">Brief</div><p className="whitespace-pre-line">{c.description}</p></div>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold">Obsah kampaně</h2>
          <ContentBoard posts={posts.map(toPostView)} options={options} currentUserId={user.id} canEdit={canEdit} canDelete={can(user.role, "marketing", "delete")} hideCampaignFilter />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Leady z kampaně {leadCount > leads.length ? `(posledních ${leads.length} z ${leadCount})` : `(${leadCount})`}</CardTitle></CardHeader>
          <CardContent>
            {leads.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Zatím žádné. U leadu vyplňte pole Kampaň = <b>{utm}</b> nebo název kampaně.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead className="text-xs text-muted-foreground"><tr className="text-left"><th className="font-medium pb-1">Lead</th><th className="font-medium">Zdroj</th><th className="font-medium">Stav</th><th className="font-medium text-right">Vytvořen</th></tr></thead>
                  <tbody>
                    {leads.map((l) => {
                      const ls = findMeta(LEAD_STATUSES, l.status);
                      return (
                        <tr key={l.id} className="border-t">
                          <td className="py-1.5">{[l.firstName, l.lastName].filter(Boolean).join(" ") || "—"}{l.companyName && <span className="text-muted-foreground"> · {l.companyName}</span>}</td>
                          <td className="text-xs">{l.source ?? "—"}</td>
                          <td>{ls && <StatusBadge label={ls.label} color={ls.color} />}</td>
                          <td className="text-right text-xs text-muted-foreground">{formatDate(l.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

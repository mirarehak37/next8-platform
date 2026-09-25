import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { CampaignFormDialog } from "@/components/marketing/campaign-form-dialog";
import { CAMPAIGN_STATUSES, MARKETING_AUDIENCES, MARKETING_CHANNELS, findMeta } from "@/lib/constants";
import { campaignLeadWhere } from "@/lib/marketing-queries";
import { formatCurrency, formatDate } from "@/lib/format";
import { CalendarDays } from "lucide-react";

export default async function CampaignsPage() {
  const session = await auth();
  const user = session!.user;
  if (!can(user.role, "marketing", "view")) redirect("/dashboard");

  const [campaigns, owners] = await Promise.all([
    prisma.marketingCampaign.findMany({
      where: { tenantId: user.tenantId },
      include: { owner: { select: { name: true } }, _count: { select: { posts: true } } },
      orderBy: [{ startDate: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
    }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const leadCounts = await Promise.all(campaigns.map((c) => prisma.lead.count({ where: campaignLeadWhere(user.tenantId, c) })));
  const order = ["active", "planned", "paused", "done"];
  const sorted = campaigns.map((c, i) => ({ c, leads: leadCounts[i] })).sort((a, b) => order.indexOf(a.c.status) - order.indexOf(b.c.status));

  return (
    <div>
      <PageHeader
        title="Kampaně"
        description={`${campaigns.filter((c) => c.status === "active").length} běží · ${campaigns.length} celkem`}
        breadcrumbs={[{ label: "Marketing", href: "/marketing" }, { label: "Kampaně" }]}
        actions={can(user.role, "marketing", "create") ? <CampaignFormDialog owners={owners} currentUserId={user.id} /> : null}
      />
      <div className="p-6">
        {sorted.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground border rounded-md border-dashed">
            Zatím žádné kampaně. Kampaň spojí příspěvky, rozpočet a leady, takže uvidíte, co přineslo zákazníky.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map(({ c, leads }) => {
            const st = findMeta(CAMPAIGN_STATUSES, c.status);
            const aud = findMeta(MARKETING_AUDIENCES, c.audience);
            const cpl = c.spent && leads ? c.spent / leads : null;
            return (
              <Link key={c.id} href={`/marketing/campaigns/${c.id}`}>
                <Card className="h-full hover:bg-muted/40 transition-colors">
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {st && <StatusBadge label={st.label} color={st.color} />}
                      {aud && <StatusBadge label={aud.label} color={aud.color} />}
                    </div>
                    <div>
                      <div className="font-semibold leading-tight">{c.name}</div>
                      {c.goal && <div className="text-xs text-muted-foreground mt-1">{c.goal}</div>}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {(c.startDate || c.endDate) && <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(c.startDate)} – {formatDate(c.endDate)}</div>}
                      {c.channels.length > 0 && <div>{c.channels.map((ch) => findMeta(MARKETING_CHANNELS, ch)?.label ?? ch).join(", ")}</div>}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t">
                      <div><div className="text-muted-foreground">Příspěvky</div><div className="font-medium">{c._count.posts}</div></div>
                      <div><div className="text-muted-foreground">Leady</div><div className="font-medium">{leads}{c.targetLeads ? ` / ${c.targetLeads}` : ""}</div></div>
                      <div><div className="text-muted-foreground">Cena/lead</div><div className="font-medium">{cpl != null ? formatCurrency(cpl) : "—"}</div></div>
                    </div>
                    {c.budget ? (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Rozpočet</span><span>{formatCurrency(c.spent ?? 0)} / {formatCurrency(c.budget)}</span></div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className={(c.spent ?? 0) > c.budget ? "h-full bg-rose-500" : "h-full bg-[#FF1947]"} style={{ width: `${Math.min(100, Math.round(((c.spent ?? 0) / c.budget) * 100))}%` }} /></div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

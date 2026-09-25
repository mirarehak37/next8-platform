import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PostFormDialog } from "@/components/marketing/post-form-dialog";
import { CAMPAIGN_STATUSES, MARKETING_AUDIENCES, MARKETING_CHANNELS, findMeta } from "@/lib/constants";
import { engagementRate, formatPercent, formatPostTime, interactions, toPragueWallClock } from "@/lib/marketing";
import { campaignLeadWhere, loadPostFormOptions, postInclude, toPostView } from "@/lib/marketing-queries";
import { CalendarClock, CheckCircle2, Eye, Heart, Lightbulb, Send } from "lucide-react";

const DAY = 24 * 60 * 60 * 1000;

export default async function MarketingOverviewPage() {
  const session = await auth();
  const user = session!.user;
  if (!can(user.role, "marketing", "view")) redirect("/dashboard");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const in7 = new Date(now.getTime() + 7 * DAY);
  const in14 = new Date(now.getTime() + 14 * DAY);
  const ago90 = new Date(now.getTime() - 90 * DAY);
  const t = user.tenantId;

  const [upcoming, review, ideas, published90, campaigns, options] = await Promise.all([
    prisma.marketingPost.findMany({
      where: { tenantId: t, status: { notIn: ["published", "cancelled"] }, scheduledAt: { gte: now, lt: in14 } },
      include: postInclude,
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.marketingPost.findMany({ where: { tenantId: t, status: "review" }, include: postInclude, orderBy: { scheduledAt: { sort: "asc", nulls: "last" } } }),
    prisma.marketingPost.count({ where: { tenantId: t, status: "idea" } }),
    prisma.marketingPost.findMany({ where: { tenantId: t, status: "published", publishedAt: { gte: ago90 } }, include: postInclude }),
    prisma.marketingCampaign.findMany({ where: { tenantId: t, status: { in: ["active", "planned"] } }, orderBy: { startDate: { sort: "asc", nulls: "last" } } }),
    loadPostFormOptions(t),
  ]);
  const leadCounts = await Promise.all(campaigns.map((c) => prisma.lead.count({ where: campaignLeadWhere(t, c) })));

  const month = published90.filter((p) => p.publishedAt! >= monthStart);
  const reachMonth = month.reduce((s, p) => s + (p.reach ?? 0), 0);
  const rates = month.map(engagementRate).filter((r): r is number => r != null);
  const avgEr = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  const next7 = upcoming.filter((p) => p.scheduledAt! < in7);

  // Days in the next 14 without anything planned — the gaps a content calendar is meant to close.
  const plannedDays = new Set(upcoming.map((p) => toPragueWallClock(p.scheduledAt!).toDateString()));
  const today = toPragueWallClock(now);
  let gaps = 0;
  for (let i = 0; i < 14; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    if (!plannedDays.has(d.toDateString())) gaps++;
  }

  const top = [...published90]
    .map((p) => ({ p, er: engagementRate(p) }))
    .filter((x) => x.er != null)
    .sort((a, b) => b.er! - a.er!)
    .slice(0, 5);

  const byChannel = MARKETING_CHANNELS.map((c) => {
    const list = published90.filter((p) => p.channel === c.value);
    const r = list.map(engagementRate).filter((x): x is number => x != null);
    return { label: c.label, count: list.length, reach: list.reduce((s, p) => s + (p.reach ?? 0), 0), er: r.length ? r.reduce((a, b) => a + b, 0) / r.length : null };
  }).filter((c) => c.count > 0);

  const audienceMix = MARKETING_AUDIENCES.map((a) => ({ ...a, count: published90.filter((p) => p.audience === a.value).length + upcoming.filter((p) => p.audience === a.value).length }));
  const audienceTotal = audienceMix.reduce((s, a) => s + a.count, 0);

  const canEdit = can(user.role, "marketing", "edit");
  const dialogProps = { options, currentUserId: user.id, readOnly: !canEdit, canDelete: can(user.role, "marketing", "delete") };

  return (
    <div>
      <PageHeader
        title="Marketing"
        description="Sociální sítě, obsah a kampaně na jednom místě"
        breadcrumbs={[{ label: "Marketing" }]}
        actions={can(user.role, "marketing", "create") ? <PostFormDialog options={options} currentUserId={user.id} /> : null}
      />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard label="Publikováno tento měsíc" value={String(month.length)} icon={Send} />
          <KpiCard label="Naplánováno na 7 dní" value={String(next7.length)} icon={CalendarClock} hint={gaps ? `${gaps} dní ze 14 bez obsahu` : "plán na 14 dní je plný"} />
          <KpiCard label="Nápady v zásobníku" value={String(ideas)} icon={Lightbulb} />
          <KpiCard label="Ke schválení" value={String(review.length)} icon={CheckCircle2} />
          <KpiCard label="Dosah tento měsíc" value={reachMonth.toLocaleString("cs-CZ")} icon={Eye} />
          <KpiCard label="Průměrný engagement" value={formatPercent(avgEr)} icon={Heart} hint="interakce / dosah" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Plán na 14 dní</CardTitle>
              <Link href="/marketing/content" className="text-xs text-muted-foreground hover:text-foreground">Celá tabule →</Link>
            </CardHeader>
            <CardContent className="space-y-1">
              {upcoming.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nic naplánováno. Vyberte něco ze zásobníku nápadů.</p>}
              {upcoming.map((p) => <PostRow key={p.id} post={toPostView(p)} dialogProps={dialogProps} />)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Čeká na schválení</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {review.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nic nečeká.</p>}
              {review.map((p) => <PostRow key={p.id} post={toPostView(p)} dialogProps={dialogProps} />)}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Top příspěvky (90 dní)</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {top.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Doplňte výsledky u publikovaných příspěvků.</p>}
              {top.map(({ p, er }) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-sm py-1">
                  <PostFormDialog {...dialogProps} post={toPostView(p)} trigger={<button type="button" className="truncate text-left hover:underline">{p.title}</button>} />
                  <span className="text-xs whitespace-nowrap"><b>{formatPercent(er)}</b> <span className="text-muted-foreground">· {interactions(p)} int.</span></span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Kanály (90 dní)</CardTitle></CardHeader>
            <CardContent>
              {byChannel.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Zatím nic publikováno.</p> : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground"><tr><th className="text-left font-medium pb-1">Kanál</th><th className="text-right font-medium">Postů</th><th className="text-right font-medium">Dosah</th><th className="text-right font-medium">ER</th></tr></thead>
                  <tbody>
                    {byChannel.map((c) => (
                      <tr key={c.label} className="border-t"><td className="py-1.5">{c.label}</td><td className="text-right tabular-nums">{c.count}</td><td className="text-right tabular-nums">{c.reach.toLocaleString("cs-CZ")}</td><td className="text-right tabular-nums">{formatPercent(c.er)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Mix publika</CardTitle></CardHeader>
            <CardContent className="space-y-2.5">
              <p className="text-xs text-muted-foreground">Publikované za 90 dní + plán. Každý příspěvek míří na jedno publikum.</p>
              {audienceMix.map((a) => (
                <div key={a.value} className="space-y-1">
                  <div className="flex justify-between text-xs"><span>{a.label}</span><span className="text-muted-foreground">{a.count}</span></div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-[#FF1947]" style={{ width: `${audienceTotal ? Math.round((a.count / audienceTotal) * 100) : 0}%` }} /></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Běžící a plánované kampaně</CardTitle>
            <Link href="/marketing/campaigns" className="text-xs text-muted-foreground hover:text-foreground">Všechny kampaně →</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {campaigns.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Žádná aktivní kampaň.</p>}
            {campaigns.map((c, i) => {
              const st = findMeta(CAMPAIGN_STATUSES, c.status);
              const leads = leadCounts[i];
              return (
                <Link key={c.id} href={`/marketing/campaigns/${c.id}`} className="block rounded-md border p-3 hover:bg-muted/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-sm">{c.name}</span>
                    {st && <StatusBadge label={st.label} color={st.color} />}
                  </div>
                  {c.goal && <div className="text-xs text-muted-foreground mt-0.5">{c.goal}</div>}
                  <div className="text-xs mt-1.5">Leady: <b>{leads}</b>{c.targetLeads ? ` / ${c.targetLeads}` : ""}</div>
                  {c.targetLeads ? (
                    <div className="h-1.5 mt-1 rounded-full bg-muted overflow-hidden"><div className="h-full bg-[#FF1947]" style={{ width: `${Math.min(100, Math.round((leads / c.targetLeads) * 100))}%` }} /></div>
                  ) : null}
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PostRow({ post, dialogProps }: { post: ReturnType<typeof toPostView>; dialogProps: Omit<React.ComponentProps<typeof PostFormDialog>, "post"> }) {
  const ch = findMeta(MARKETING_CHANNELS, post.channel);
  const aud = findMeta(MARKETING_AUDIENCES, post.audience);
  return (
    <div className="flex items-center gap-3 py-1.5 border-b last:border-0 text-sm">
      <span className="w-28 shrink-0 text-xs text-muted-foreground">{formatPostTime(post.scheduledAt)}</span>
      <div className="min-w-0 flex-1">
        <PostFormDialog {...dialogProps} post={post} trigger={<button type="button" className="block max-w-full truncate text-left font-medium hover:underline">{post.title}</button>} />
        <div className="text-xs text-muted-foreground truncate">{ch?.label}{post.ambassadorName ? ` · ${post.ambassadorName}` : ""} · {post.ownerName}</div>
      </div>
      {aud && <StatusBadge label={aud.label} color={aud.color} className="hidden sm:inline-flex" />}
    </div>
  );
}

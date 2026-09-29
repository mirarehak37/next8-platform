import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketMap } from "@/components/market/market-map";
import { MarketFilters } from "@/components/market/market-filters";
import { MARKET_STATES, loadMarket, loadMarketFilterOptions, type Counts, type MarketState } from "@/lib/market";
import { KRAJE, krajLabel } from "@/lib/kraje";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Building2, Handshake, Target, Trophy, Users, Wallet } from "lucide-react";

type Search = { sport?: string; category?: string; league?: string; owner?: string; region?: string; view?: string };

const pct = (v: number | null) => (v == null ? "—" : v > 0 && v < 0.01 ? "<1 %" : `${Math.round(v * 100)} %`);
const stateMeta = (s: MarketState) => MARKET_STATES.find((x) => x.value === s)!;

function StackBar({ c }: { c: Counts }) {
  if (!c.total) return <div className="h-2 rounded-full bg-muted" />;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-muted">
      {MARKET_STATES.map((s) => (c[s.value] ? <div key={s.value} style={{ width: `${(c[s.value] / c.total) * 100}%`, background: s.fill }} title={`${s.label}: ${c[s.value]}`} /> : null))}
    </div>
  );
}

export default async function MarketPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const session = await auth();
  const user = session!.user;
  if (!can(user.role, "company", "view")) redirect("/dashboard");

  const filters = { sport: sp.sport, category: sp.category, league: sp.league, owner: sp.owner };
  const [market, options] = await Promise.all([loadMarket(user, filters), loadMarketFilterOptions(user)]);
  const region = KRAJE.some((k) => k.code === sp.region) ? sp.region : undefined;
  const tone = sp.view === "coverage" ? "coverage" : "potential";

  const link = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
    const q = p.toString();
    return `/crm/market${q ? `?${q}` : ""}`;
  };

  const { totals, regions } = market;
  const wonTotal = regions.reduce((s, r) => s + r.wonValue, 0);

  // "Kam jít teď": the biggest open opportunities, with who could go there.
  const tips = regions
    .filter((r) => r.teams.total > 0)
    .flatMap((r) => {
      const out: { score: number; region: string; text: string }[] = [];
      if (r.teams.negotiating) out.push({ score: r.teams.negotiating * 4, region: r.code, text: `Dotáhnout ${r.teams.negotiating} rozjednaných týmů` });
      if (r.potential) {
        out.push(
          r.ambassadors.length
            ? { score: r.potential, region: r.code, text: `${r.potential} neoslovených týmů – může jet ${r.ambassadors.slice(0, 2).join(", ")}` }
            : { score: r.potential * 0.9, region: r.code, text: `${r.potential} neoslovených týmů a žádný ambasador – najít ambasadora v kraji` },
        );
      }
      return out;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const regionRows = [...regions].sort((a, b) => b.potential - a.potential || b.teams.total - a.teams.total);
  const sel = region ? regions.find((r) => r.code === region)! : null;

  const clubList = market.clubs
    .filter((c) => (region ? c.region === region : c.state === "untouched" || c.state === "contacted"))
    .sort((a, b) => {
      const order: MarketState[] = ["negotiating", "contacted", "untouched", "customer", "lost"];
      return order.indexOf(a.state) - order.indexOf(b.state) || b.teams.length - a.teams.length || a.name.localeCompare(b.name, "cs");
    })
    .slice(0, region ? 200 : 30);

  return (
    <div>
      <PageHeader
        title="Mapa trhu"
        description="Kde už NEXT8 má týmy, kde se jedná a kde ještě nikdo nebyl"
        breadcrumbs={[{ label: "CRM" }, { label: "Mapa trhu" }]}
      />
      <div className="p-6 space-y-6">
        <MarketFilters {...options} />

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard label="Kluby" value={String(totals.clubs.total)} icon={Building2} hint={`${totals.clubs.customer} zákazníků`} />
          <KpiCard label="Týmy" value={String(totals.teams.total)} icon={Users} />
          <KpiCard label="Týmy se zákazníkem" value={String(totals.teams.customer)} icon={Trophy} hint={`pokrytí ${pct(totals.teams.total ? totals.teams.customer / totals.teams.total : null)}`} />
          <KpiCard label="Jednáme" value={String(totals.teams.negotiating)} icon={Handshake} hint="týmů s otevřeným obchodem" />
          <KpiCard label="Neosloveno" value={String(totals.teams.untouched)} icon={Target} hint={`týmů · ${totals.teams.contacted} osloveno`} />
          <KpiCard label="Vyhrané obchody" value={formatCurrency(wonTotal)} icon={Wallet} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{tone === "coverage" ? "Pokrytí týmů podle krajů" : "Neoslovené a oslovené týmy podle krajů"}</CardTitle>
              <div className="flex gap-1 rounded-lg border p-1 text-xs">
                <Link href={link({ view: undefined })} className={cn("rounded-md px-2.5 py-1", tone === "potential" ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:bg-muted")}>Příležitosti</Link>
                <Link href={link({ view: "coverage" })} className={cn("rounded-md px-2.5 py-1", tone === "coverage" ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:bg-muted")}>Pokrytí</Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <MarketMap
                tone={tone}
                selected={region}
                clubs={market.clubs}
                hrefFor={(code) => link({ region: code === region ? undefined : code })}
                regions={regions.map((r) => ({
                  code: r.code,
                  label: r.label,
                  value: tone === "coverage" ? r.coverage ?? 0 : r.potential,
                  display: tone === "coverage" ? pct(r.coverage) : String(r.potential),
                  title: `${r.label}: ${r.clubs.total} klubů, ${r.teams.total} týmů · zákazník ${r.teams.customer} · jednáme ${r.teams.negotiating} · neosloveno ${r.teams.untouched}`,
                }))}
              />
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {MARKET_STATES.map((s) => (
                  <span key={s.value} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.fill }} /> {s.label}</span>
                ))}
                <span>· tečka = klub, kliknutím na kraj ho vyberete</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Kam jít teď</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {tips.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Zatím žádná data o týmech.</p>}
              {tips.map((t, i) => (
                <Link key={i} href={link({ region: t.region })} className="block rounded-md border p-2.5 hover:bg-muted/40">
                  <div className="text-xs font-semibold">{krajLabel(t.region)}</div>
                  <div className="text-sm">{t.text}</div>
                </Link>
              ))}
              {totals.noRegion > 0 && (
                <p className="text-xs text-muted-foreground pt-1">{totals.noRegion} klubů nemá město ani kraj – doplňte je v detailu klubu.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {sel && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Kraj {sel.label}</CardTitle>
              <Link href={link({ region: undefined })} className="text-xs text-muted-foreground hover:text-foreground">Zrušit výběr ✕</Link>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div><div className="text-xs text-muted-foreground">Kluby / týmy</div>{sel.clubs.total} / {sel.teams.total}</div>
              <div><div className="text-xs text-muted-foreground">Pokrytí týmů</div>{pct(sel.coverage)} ({sel.teams.customer} zákazníků, {sel.teams.negotiating} jednáme)</div>
              <div><div className="text-xs text-muted-foreground">Ambasadoři v kraji</div>{sel.ambassadors.join(", ") || "žádný"}</div>
              <div><div className="text-xs text-muted-foreground">Obchodníci (vlastníci klubů)</div>{sel.owners.map(([n, c]) => `${n} (${c})`).join(", ") || "—"}</div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Kraje</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="text-xs text-muted-foreground">
                <tr className="text-left">
                  <th className="font-medium pb-2">Kraj</th>
                  <th className="font-medium text-right">Kluby</th>
                  <th className="font-medium text-right">Týmy</th>
                  <th className="font-medium w-40 px-3">Stav týmů</th>
                  <th className="font-medium text-right">Zákazník</th>
                  <th className="font-medium text-right">Jednáme</th>
                  <th className="font-medium text-right">Neosloveno</th>
                  <th className="font-medium text-right">Pokrytí</th>
                  <th className="font-medium pl-4">Ambasadoři</th>
                </tr>
              </thead>
              <tbody>
                {regionRows.map((r) => (
                  <tr key={r.code} className={cn("border-t", r.code === region && "bg-muted/50")}>
                    <td className="py-2"><Link href={link({ region: r.code })} className="font-medium hover:underline">{r.label}</Link></td>
                    <td className="text-right tabular-nums">{r.clubs.total}</td>
                    <td className="text-right tabular-nums">{r.teams.total}</td>
                    <td className="px-3"><StackBar c={r.teams} /></td>
                    <td className="text-right tabular-nums">{r.teams.customer}</td>
                    <td className="text-right tabular-nums">{r.teams.negotiating}</td>
                    <td className="text-right tabular-nums">{r.teams.untouched}</td>
                    <td className="text-right tabular-nums">{pct(r.coverage)}</td>
                    <td className={cn("pl-4 text-xs", !r.ambassadors.length && r.potential > 0 && "text-rose-600")}>{r.ambassadors.length ? r.ambassadors.join(", ") : r.potential > 0 ? "chybí" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{sel ? `Kluby v kraji ${sel.label} (${clubList.length})` : "Největší příležitosti – neoslovené a oslovené kluby"}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {clubList.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Nic tu není.</p> : (
              <table className="w-full text-sm min-w-[640px]">
                <thead className="text-xs text-muted-foreground">
                  <tr className="text-left"><th className="font-medium pb-2">Klub</th><th className="font-medium">Město</th><th className="font-medium">Stav</th><th className="font-medium">Týmy</th><th className="font-medium">Obchodník</th></tr>
                </thead>
                <tbody>
                  {clubList.map((c) => {
                    const st = stateMeta(c.state);
                    const teamCounts = MARKET_STATES.map((s) => [s, c.teams.filter((t) => t.state === s.value).length] as const).filter(([, n]) => n > 0);
                    return (
                      <tr key={c.id} className="border-t">
                        <td className="py-2"><Link href={`/crm/companies/${c.id}`} className="font-medium hover:underline">{c.name}</Link></td>
                        <td className="text-xs">{c.city ?? "—"}{!region && c.region && <span className="text-muted-foreground"> · {krajLabel(c.region)}</span>}</td>
                        <td><StatusBadge label={st.label} color={st.color} /></td>
                        <td className="text-xs">
                          {c.teams.length}
                          {teamCounts.length > 1 && <span className="text-muted-foreground"> ({teamCounts.map(([s, n]) => `${n} ${s.label.toLowerCase()}`).join(", ")})</span>}
                        </td>
                        <td className="text-xs">{c.ownerName}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {([["Soutěže", market.byLeague, "league"], ["Kategorie", market.byCategory, "category"]] as const).map(([title, rows, key]) => (
            <Card key={title}>
              <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
                {rows.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Žádné týmy.</p>}
                {rows.map(([name, c]) => (
                  <Link key={name} href={link({ [key]: name })} className="block space-y-1 rounded-md px-1 py-1 hover:bg-muted/40">
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="truncate">{name}</span>
                      <span className="text-muted-foreground whitespace-nowrap">{c.customer}/{c.total} · {c.untouched} neosl.</span>
                    </div>
                    <StackBar c={c} />
                  </Link>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { appSyncConfigured, type AppMetrics } from "@/lib/app-sync";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { StatCard, StatGrid, Panel } from "@/components/common/stat-card";
import { Tag } from "@/components/common/tag";
import { ActivityTrendChart, RegistrationsChart, SyncNowButton } from "@/components/reports/app-report-charts";

// The manual "Synchronizovat teď" runs as a server action of this page.
export const maxDuration = 120;

const ACTIVITY_ORDER = ["Denní", "Pravidelný", "Občasný", "Spící", "Ztracený", "Nedokončil"];

function window30() {
  const now = new Date();
  return { today: now.toISOString().slice(0, 10), in30: new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10) };
}

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const contactsTag = (tag: string) => `/crm/contacts?tag=${encodeURIComponent(tag)}`;

function delta(now: number, before: number | undefined) {
  if (before == null) return null;
  const d = now - before;
  return { text: `${d > 0 ? "+" : ""}${d}`, tone: d > 0 ? "text-success" : d < 0 ? "text-danger" : "text-subtle" };
}

function weekly(registrationsByDay: Record<string, number>, weeks = 26) {
  const days = Object.keys(registrationsByDay).sort();
  if (!days.length) return [];
  const monday = (iso: string) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const byWeek = new Map<string, number>();
  for (const d of days) byWeek.set(monday(d), (byWeek.get(monday(d)) ?? 0) + registrationsByDay[d]);
  const start = new Date(`${monday(days[0])}T12:00:00Z`);
  const end = new Date(`${monday(new Date().toISOString().slice(0, 10))}T12:00:00Z`);
  const out: { week: string; registrations: number; total: number }[] = [];
  let total = 0;
  for (const d = start; d <= end; d.setUTCDate(d.getUTCDate() + 7)) {
    const key = d.toISOString().slice(0, 10);
    const n = byWeek.get(key) ?? 0;
    total += n;
    out.push({ week: `${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`, registrations: n, total });
  }
  return out.slice(-weeks);
}

function BarList({
  title,
  data,
  tagPrefix,
  order,
  total,
}: {
  title: string;
  data: Record<string, number>;
  tagPrefix?: string;
  order?: string[];
  total?: number;
}) {
  const entries = Object.entries(data).sort((a, b) => {
    if (order) {
      const i = (k: string) => {
        const x = order.findIndex((o) => k.startsWith(o));
        return x === -1 ? order.length : x;
      };
      return i(a[0]) - i(b[0]);
    }
    return b[1] - a[1];
  });
  const peak = Math.max(1, ...entries.map(([, n]) => n));
  const sum = total ?? entries.reduce((s, [, n]) => s + n, 0);
  return (
    <Panel className="flex flex-col">
      <div className="border-b px-4 py-3 text-sm font-medium">{title}</div>
      <ul className="flex flex-col p-2">
        {entries.map(([label, count]) => {
          const row = (
            <>
              <span className="w-[44%] min-w-0 truncate text-sm" title={label}>{label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/6">
                <span className="block h-full rounded-full bg-brand/80" style={{ width: `${(count / peak) * 100}%` }} />
              </span>
              <span className="w-10 text-right text-sm tabular-nums">{count}</span>
              <span className="caption-style w-9 text-right text-subtle tabular-nums">{pct(count, sum)} %</span>
            </>
          );
          return (
            <li key={label}>
              {tagPrefix && label !== "Neuvedeno" ? (
                <Link href={contactsTag(`${tagPrefix}: ${label}`)} className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-white/4">
                  {row}
                  <ArrowRight className="size-3.5 shrink-0 text-faint group-hover:text-foreground" />
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-2 py-1.5">
                  {row}
                  <span className="w-3.5" />
                </div>
              )}
            </li>
          );
        })}
        {entries.length === 0 && <li className="caption-style px-2 py-4 text-center text-subtle">Bez dat</li>}
      </ul>
    </Panel>
  );
}

export default async function AppReportPage() {
  const session = await auth();
  const user = session!.user;
  if (!can(user.role, "report", "view")) redirect("/dashboard");
  const tenantId = user.tenantId;
  const configured = appSyncConfigured();

  const [snapshots, runs] = await Promise.all([
    prisma.appMetricSnapshot.findMany({ where: { tenantId }, orderBy: { date: "asc" }, take: 400 }),
    prisma.appSyncRun.findMany({ where: { tenantId }, orderBy: { startedAt: "desc" }, take: 5 }),
  ]);
  const latest = snapshots.at(-1);
  const m = latest?.metrics as AppMetrics | undefined;
  const weekAgo = latest
    ? [...snapshots].reverse().find((s) => s.date.getTime() <= latest.date.getTime() - 6.5 * 86_400_000)
    : undefined;
  const prev = weekAgo?.metrics as AppMetrics | undefined;
  const lastRun = runs[0];
  const canSync = can(user.role, "contact", "create");

  const { today, in30 } = window30();
  const expiring = m
    ? await prisma.customFieldValue.findMany({
        where: { definition: { tenantId, entityType: "contact", key: "app_subscription_until" }, value: { gte: today, lte: in30 } },
        select: { entityId: true, value: true },
        orderBy: { value: "asc" },
        take: 20,
      })
    : [];
  const expiringContacts = expiring.length
    ? await prisma.contact.findMany({ where: { tenantId, id: { in: expiring.map((e) => e.entityId) } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const contactName = new Map(expiringContacts.map((c) => [c.id, `${c.firstName} ${c.lastName}`]));

  const growth = m ? weekly(m.registrationsByDay) : [];
  const trend = snapshots.map((s) => {
    const x = s.metrics as AppMetrics;
    return { date: `${s.date.getUTCDate()}. ${s.date.getUTCMonth() + 1}.`, active7: x.active7, active30: x.active30, pro: x.pro };
  });
  const teams = m ? Object.entries(m.byTeam).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div>
      <PageHeader
        title="Report aplikace"
        description={
          latest
            ? `Data z aplikace NEXT8 k ${formatDate(latest.date)} · synchronizace každou noc ve 3:00`
            : "Uživatelé aplikace NEXT8 ze Supabase: růst, aktivita, předplatné, týmy a souhlasy"
        }
        breadcrumbs={[{ label: "Reporty", href: "/reports" }, { label: "Report aplikace" }]}
        actions={canSync && <SyncNowButton disabled={!configured} />}
      />

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        {!configured && (
          <Panel className="space-y-3 p-4 text-sm">
            <div className="font-medium">Napojení na aplikaci ještě není nastavené</div>
            <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
              <li>
                V Supabase → SQL Editor spusťte skript <code className="rounded bg-muted px-1">scripts/supabase/crm_export.sql</code> z repozitáře CRM
                (předtím v něm nahraďte <code className="rounded bg-muted px-1">ZMENTE_HESLO</code> dlouhým heslem).
              </li>
              <li>
                Ve Vercelu (projekt next8-platform → Settings → Environment Variables) přidejte <code className="rounded bg-muted px-1">APP_DB_URL</code> =
                připojovací řetězec „Session pooler“ ze Supabase (Connect), kde uživatel je <code className="rounded bg-muted px-1">crm_reader.&lt;ref projektu&gt;</code> a heslo z kroku 1.
              </li>
              <li>
                Přidejte <code className="rounded bg-muted px-1">CRON_SECRET</code> (libovolný dlouhý náhodný text) pro noční synchronizaci a nasaďte znovu.
              </li>
            </ol>
          </Panel>
        )}

        {lastRun && (
          <div className="caption-style flex flex-wrap items-center gap-2 text-subtle">
            <Tag tone={lastRun.status === "ok" ? "green" : lastRun.status === "error" ? "red" : "amber"} size="sm">
              {lastRun.status === "ok" ? "Synchronizováno" : lastRun.status === "error" ? "Chyba synchronizace" : "Probíhá"}
            </Tag>
            <span>
              {formatDateTime(lastRun.startedAt)} · {lastRun.trigger === "cron" ? "automaticky" : "ručně"}
              {lastRun.status === "ok" && ` · ${lastRun.users} uživatelů, ${lastRun.created} nových kontaktů, ${lastRun.updated} aktualizovaných`}
            </span>
            {lastRun.error && <span className="text-danger">{lastRun.error}</span>}
          </div>
        )}

        {!m && configured && (
          <div className="rounded-lg border border-dashed border-white/8 px-4 py-16 text-center text-sm text-subtle">
            Zatím žádná data. Spusťte první synchronizaci tlačítkem nahoře.
          </div>
        )}

        {m && (
          <>
            <StatGrid className="lg:grid-cols-3 xl:grid-cols-6">
              <StatCard label="Uživatelů celkem" value={m.total} hint={`+${m.newLast30} za 30 dní`} />
              <StatCard
                label="Nové registrace (7 dní)"
                value={m.newLast7}
                hint={<span className={cn(delta(m.newLast7, m.newPrev7)?.tone)}>{delta(m.newLast7, m.newPrev7)?.text} oproti předchozímu týdnu</span>}
              />
              <StatCard
                label="Aktivní za 7 dní"
                value={m.active7}
                hint={<>{pct(m.active7, m.total)} % uživatelů{prev && <span className={cn("ml-1", delta(m.active7, prev.active7)?.tone)}>({delta(m.active7, prev.active7)?.text} za týden)</span>}</>}
              />
              <StatCard label="Aktivní za 30 dní" value={m.active30} hint={`${pct(m.active30, m.total)} % uživatelů`} />
              <StatCard
                label="PRO účty"
                value={m.pro}
                hint={<>{pct(m.pro, m.total)} % · {m.expiring30} končí do 30 dní{prev && <span className={cn("ml-1", delta(m.pro, prev.pro)?.tone)}>({delta(m.pro, prev.pro)?.text})</span>}</>}
              />
              <StatCard label="Smí obchodní sdělení" value={m.commercialOk} hint={`${m.total - m.commercialOk} jen servisní`} />
            </StatGrid>

            <div className="grid gap-4 xl:grid-cols-3">
              <Panel className="xl:col-span-2">
                <div className="border-b px-4 py-3 text-sm font-medium">Růst · registrace po týdnech</div>
                <div className="p-3">
                  <RegistrationsChart data={growth} />
                </div>
              </Panel>
              <Panel>
                <div className="border-b px-4 py-3 text-sm font-medium">Aktivita a PRO v čase</div>
                <div className="p-3">
                  <ActivityTrendChart data={trend} />
                </div>
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <BarList title="Aktivita" data={m.byActivity} tagPrefix="Aktivita" order={ACTIVITY_ORDER} />
              <BarList title="Typ účtu" data={m.byAccount} tagPrefix="Účet" />
              <BarList title="Role" data={m.byRole} tagPrefix="Role" />
              <BarList title="Registrace přes" data={m.byVia} />
              <BarList title="Platforma" data={m.byPlatform} tagPrefix="Platforma" />
              <BarList title="PRO · přes co platí" data={m.byPayment} />
              <BarList title="Věk" data={m.byAge} tagPrefix="Věk" />
              <BarList title="Marketingový souhlas" data={m.byConsent} tagPrefix="Marketing souhlas" />
              <BarList title="Pohlaví" data={m.byGender} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Panel className="overflow-hidden">
                <div className="border-b px-4 py-3 text-sm font-medium">Kohorty · jak drží</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-subtle">
                      <th className="h-[38px] px-3 text-left font-normal">Kohorta</th>
                      <th className="h-[38px] px-3 text-right font-normal">Lidí</th>
                      <th className="h-[38px] px-3 text-right font-normal">Aktivní 7 d</th>
                      <th className="h-[38px] px-3 text-right font-normal">Aktivní 30 d</th>
                      <th className="h-[38px] px-3 text-right font-normal">PRO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.cohorts.map((c) => (
                      <tr key={c.name} className="border-b last:border-b-0 hover:bg-white/3">
                        <td className="h-[42px] px-3">
                          <Link href={contactsTag(`Kohorta: ${c.name}`)} className="hover:underline">{c.name}</Link>
                        </td>
                        <td className="px-3 text-right tabular-nums">{c.size}</td>
                        <td className="px-3 text-right tabular-nums">{c.active7} <span className="caption-style text-subtle">{pct(c.active7, c.size)} %</span></td>
                        <td className="px-3 text-right tabular-nums">{c.active30} <span className="caption-style text-subtle">{pct(c.active30, c.size)} %</span></td>
                        <td className="px-3 text-right tabular-nums">{c.pro}</td>
                      </tr>
                    ))}
                    {m.cohorts.length === 0 && (
                      <tr><td colSpan={5} className="caption-style px-3 py-6 text-center text-subtle">Žádné kohorty (definují se v SQL funkci podle data registrace).</td></tr>
                    )}
                  </tbody>
                </table>
              </Panel>

              <Panel className="overflow-hidden">
                <div className="border-b px-4 py-3 text-sm font-medium">Týmy v aplikaci · {teams.length}</div>
                <ul className="flex flex-col p-2">
                  {teams.slice(0, 12).map(([name, n]) => (
                    <li key={name}>
                      <Link href={contactsTag(`Tým: ${name}`)} className="group flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-white/4">
                        <span className="truncate">{name}</span>
                        <span className="flex items-center gap-3 tabular-nums">
                          {n}
                          <ArrowRight className="size-3.5 text-faint group-hover:text-foreground" />
                        </span>
                      </Link>
                    </li>
                  ))}
                  {teams.length === 0 && <li className="caption-style px-2 py-6 text-center text-subtle">Zatím žádné týmy</li>}
                </ul>
              </Panel>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Panel>
                <div className="border-b px-4 py-3 text-sm font-medium">Předplatné končí do 30 dní · {m.expiring30}</div>
                <ul className="flex flex-col p-2">
                  {expiring.map((e) => (
                    <li key={e.entityId}>
                      <Link href={`/crm/contacts/${e.entityId}`} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-white/4">
                        <span className="truncate">{contactName.get(e.entityId) ?? "Kontakt"}</span>
                        <span className="caption-style text-soft tabular-nums">{formatDate(e.value)}</span>
                      </Link>
                    </li>
                  ))}
                  {expiring.length === 0 && <li className="caption-style px-2 py-6 text-center text-subtle">V příštích 30 dnech nic nekončí.</li>}
                </ul>
              </Panel>
              <BarList title="Použité slevové kódy" data={m.byCode} tagPrefix="Kód" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

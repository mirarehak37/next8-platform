import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { ownerScopeWhere } from "@/lib/scope";
import { splitGroupedTag } from "@/lib/tag-groups";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { StatCard, StatGrid, Panel } from "@/components/common/stat-card";
import { CountBadge } from "@/components/common/count-badge";

const GROUP_ORDER = ["Účet", "Aktivita", "Role", "Věk", "Tým", "Kohorta"];
const ACTIVITY_ORDER = ["Denní", "Pravidelný", "Občasný", "Spící", "Ztracený", "Nedokončil"];
const ACTIVE_VALUES = ["Denní", "Pravidelný"];

const contactsLink = (params: Record<string, string>) => `/crm/contacts?${new URLSearchParams(params).toString()}`;

function orderIndex(list: string[], value: string) {
  const i = list.findIndex((v) => value.startsWith(v));
  return i === -1 ? list.length : i;
}

function sortValues(group: string, entries: [string, number][]) {
  if (group === "Aktivita") return entries.sort((a, b) => orderIndex(ACTIVITY_ORDER, a[0]) - orderIndex(ACTIVITY_ORDER, b[0]));
  return entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "cs"));
}

export default async function SegmentsPage() {
  const session = await auth();
  const user = session!.user;
  if (!can(user.role, "contact", "view")) redirect("/dashboard");

  const scope = await ownerScopeWhere(user, "contact");
  const contacts = await prisma.contact.findMany({ where: scope, select: { id: true, marketingConsent: true } });
  const tagged = contacts.length
    ? await prisma.taggedItem.findMany({
        where: { entityType: "contact", entityId: { in: contacts.map((c) => c.id) }, tag: { tenantId: user.tenantId } },
        select: { entityId: true, tag: { select: { name: true } } },
      })
    : [];

  // group -> value -> contact ids; plain tags -> contact ids
  const groups = new Map<string, Map<string, Set<string>>>();
  const plain = new Map<string, Set<string>>();
  const byContact = new Map<string, Map<string, string>>();
  for (const t of tagged) {
    const parsed = splitGroupedTag(t.tag.name);
    if (parsed) {
      const values = groups.get(parsed.group) ?? new Map<string, Set<string>>();
      values.set(parsed.value, (values.get(parsed.value) ?? new Set()).add(t.entityId));
      groups.set(parsed.group, values);
      const own = byContact.get(t.entityId) ?? new Map<string, string>();
      own.set(parsed.group, parsed.value);
      byContact.set(t.entityId, own);
    } else {
      plain.set(t.tag.name, (plain.get(t.tag.name) ?? new Set()).add(t.entityId));
    }
  }

  const total = contacts.length;
  const fromApp = plain.get("Aplikace NEXT8")?.size ?? 0;
  const consent = contacts.filter((c) => c.marketingConsent).length;
  const activity = groups.get("Aktivita");
  const active = activity
    ? new Set(ACTIVE_VALUES.flatMap((v) => [...activity.entries()].filter(([k]) => k.startsWith(v)).flatMap(([, ids]) => [...ids]))).size
    : 0;

  const orderedGroups = [...groups.entries()].sort(
    (a, b) => orderIndex(GROUP_ORDER, a[0]) - orderIndex(GROUP_ORDER, b[0]) || a[0].localeCompare(b[0], "cs"),
  );

  const accounts = groups.get("Účet");
  const accountRows = accounts ? sortValues("Účet", [...accounts.entries()].map(([k, ids]) => [k, ids.size] as [string, number])) : [];
  const activityCols = activity ? sortValues("Aktivita", [...activity.entries()].map(([k, ids]) => [k, ids.size] as [string, number])) : [];
  const cross = (account: string, act: string) =>
    [...(accounts?.get(account) ?? [])].filter((id) => byContact.get(id)?.get("Aktivita") === act).length;

  return (
    <div>
      <PageHeader
        title="Segmenty kontaktů"
        description="Statistiky podle tagů. Kliknutím na hodnotu otevřeš seznam konkrétních lidí."
        breadcrumbs={[{ label: "CRM" }, { label: "Kontakty", href: "/crm/contacts" }, { label: "Segmenty" }]}
      />

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <StatGrid>
          <StatCard label="Kontakty celkem" value={total} />
          <StatCard label="Z aplikace NEXT8" value={fromApp} hint={total ? `${Math.round((fromApp / total) * 100)} % kontaktů` : undefined} />
          <StatCard
            label="Smí obchodní sdělení"
            value={<Link href={contactsLink({ consent: "yes" })} className="hover:underline">{consent}</Link>}
            hint={`${total - consent} jen servisní e-maily`}
          />
          <StatCard
            label="Aktivní (denní + pravidelní)"
            value={active}
            hint={fromApp ? `${Math.round((active / fromApp) * 100)} % uživatelů aplikace` : "podle tagů Aktivita"}
          />
        </StatGrid>

        {tagged.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/8 px-4 py-16 text-center">
            <span className="text-sm font-medium">Kontakty zatím nemají tagy</span>
            <span className="caption-style max-w-sm leading-snug text-subtle">
              Naimportuj kontakty se sloupcem Tagy (např. „Aktivita: Denní, Účet: Free sám“). Každý další import stav přepíše.
            </span>
            <Link href="/crm/import" className="mt-2 text-sm text-foreground underline underline-offset-2 hover:text-soft">
              Otevřít import dat
            </Link>
          </div>
        )}

        {accountRows.length > 0 && activityCols.length > 0 && (
          <Panel className="overflow-hidden">
            <div className="border-b px-4 py-3 text-sm font-medium">Typ účtu × aktivita</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="h-[38px] px-3 text-left text-xs font-normal text-subtle">Účet</th>
                    {activityCols.map(([act]) => (
                      <th key={act} className="h-[38px] px-3 text-right text-xs font-normal whitespace-nowrap text-subtle">
                        {act.replace(/\s*\(.*\)$/, "")}
                      </th>
                    ))}
                    <th className="h-[38px] px-3 text-right text-xs font-normal text-subtle">Celkem</th>
                  </tr>
                </thead>
                <tbody>
                  {accountRows.map(([account, count]) => (
                    <tr key={account} className="border-b last:border-b-0 hover:bg-white/3">
                      <td className="h-[42px] px-3">
                        <Link href={contactsLink({ tag: `Účet: ${account}` })} className="hover:underline">{account}</Link>
                      </td>
                      {activityCols.map(([act]) => {
                        const n = cross(account, act);
                        return (
                          <td key={act} className={cn("h-[42px] px-3 text-right tabular-nums", n === 0 && "text-faint")}>
                            {n}
                          </td>
                        );
                      })}
                      <td className="h-[42px] px-3 text-right font-medium tabular-nums">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {orderedGroups.map(([group, values]) => {
            const entries = sortValues(group, [...values.entries()].map(([k, ids]) => [k, ids.size] as [string, number]));
            const peak = Math.max(1, ...entries.map(([, n]) => n));
            const members = new Set([...values.values()].flatMap((ids) => [...ids])).size;
            return (
              <Panel key={group} className="flex flex-col">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <span className="text-sm font-medium">{group}</span>
                  <CountBadge>{members}</CountBadge>
                </div>
                <ul className="flex flex-col p-2">
                  {entries.map(([value, count]) => (
                    <li key={value}>
                      <Link
                        href={contactsLink({ tag: `${group}: ${value}` })}
                        className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-white/4"
                      >
                        <span className="w-[42%] min-w-0 truncate text-sm" title={value}>{value}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/6">
                          <span className="block h-full rounded-full bg-brand/80" style={{ width: `${(count / peak) * 100}%` }} />
                        </span>
                        <span className="w-10 text-right text-sm tabular-nums">{count}</span>
                        <span className="caption-style w-10 text-right text-subtle tabular-nums">
                          {members ? Math.round((count / members) * 100) : 0} %
                        </span>
                        <ArrowRight className="size-3.5 shrink-0 text-faint transition-colors group-hover:text-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            );
          })}

          {plain.size > 0 && (
            <Panel className="flex flex-col">
              <div className="border-b px-4 py-3 text-sm font-medium">Ostatní tagy</div>
              <ul className="flex flex-col p-2">
                {[...plain.entries()]
                  .sort((a, b) => b[1].size - a[1].size)
                  .map(([name, ids]) => (
                    <li key={name}>
                      <Link
                        href={contactsLink({ tag: name })}
                        className="group flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-white/4"
                      >
                        <span className="truncate">{name}</span>
                        <span className="flex items-center gap-3">
                          <span className="tabular-nums">{ids.size}</span>
                          <ArrowRight className="size-3.5 text-faint transition-colors group-hover:text-foreground" />
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

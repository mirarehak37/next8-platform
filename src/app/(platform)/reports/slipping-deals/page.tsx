import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { ownerScopeWhere } from "@/lib/scope";
import { loadSlippingDeals, SLIPPING_ACTIVITY_DAYS } from "@/lib/deal-insights";
import { formatCurrency, formatCurrencyCompact, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { StatCard, StatGrid, Panel } from "@/components/common/stat-card";
import { OwnerBadge } from "@/components/common/owner-badge";
import { Tag, stageTone } from "@/components/common/tag";
import { SlippingActions } from "@/components/common/slipping-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function SlippingDealsPage() {
  const session = await auth();
  const user = session!.user;
  if (!can(user.role, "deal", "view")) redirect("/dashboard");

  const scope = await ownerScopeWhere(user, "deal");
  const slipping = await loadSlippingDeals(scope, user.tenantId);

  const atRisk = slipping.reduce((sum, row) => sum + row.deal.value, 0);
  const overdue = slipping.filter((row) => row.reasons.some((r) => r.kind === "overdue")).length;
  const quietOnly = slipping.filter((row) => row.reasons.every((r) => r.kind === "quiet")).length;
  const canLog = can(user.role, "activity", "create");
  const canEdit = can(user.role, "deal", "edit");

  return (
    <div>
      <PageHeader
        title="Ohrožené obchody"
        description={`Otevřené obchody po termínu uzavření nebo bez aktivity déle než ${SLIPPING_ACTIVITY_DAYS} dní.`}
        breadcrumbs={[{ label: "Reporty", href: "/reports" }, { label: "Ohrožené obchody" }]}
      />

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <StatGrid>
          <StatCard label="Ohrožené obchody" value={slipping.length} />
          <StatCard label="Hodnota v ohrožení" value={formatCurrencyCompact(atRisk)} />
          <StatCard label="Po termínu uzavření" value={overdue} />
          <StatCard label="Utichlé" value={quietOnly} hint="jen bez aktivity" />
        </StatGrid>

        <Panel className="overflow-hidden">
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow>
                <TableHead>Obchod</TableHead>
                <TableHead>Fáze</TableHead>
                <TableHead className="text-right">Hodnota</TableHead>
                <TableHead>Uzavření</TableHead>
                <TableHead>Proč je ohrožený</TableHead>
                <TableHead>Vlastník</TableHead>
                <TableHead className="text-right">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slipping.map(({ deal, reasons }) => (
                <TableRow key={deal.id}>
                  <TableCell className="max-w-[220px]">
                    <Link href={`/crm/deals/${deal.id}`} className="block truncate hover:underline">
                      {deal.name}
                    </Link>
                    {deal.company && (
                      <Link
                        href={`/crm/companies/${deal.company.id}`}
                        className="caption-style mt-1 block truncate text-subtle hover:text-soft"
                      >
                        {deal.company.name}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell>
                    <Tag tone={stageTone(deal.stage)} size="sm">
                      {deal.stage.name}
                    </Tag>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(deal.value, deal.currency)}</TableCell>
                  <TableCell className="text-soft tabular-nums">{formatDate(deal.expectedCloseDate)}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {reasons.map((reason) => (
                        <Tag key={reason.kind} tone={reason.kind === "overdue" ? "red" : "amber"} size="sm">
                          {reason.label}
                        </Tag>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell>
                    <OwnerBadge name={deal.owner.name} />
                  </TableCell>
                  <TableCell>
                    <SlippingActions dealId={deal.id} canLog={canLog} canEdit={canEdit} />
                  </TableCell>
                </TableRow>
              ))}
              {slipping.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="caption-style h-[120px] text-center text-subtle">
                    Nic se nezdržuje. Dobrá práce.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Panel>
      </div>
    </div>
  );
}

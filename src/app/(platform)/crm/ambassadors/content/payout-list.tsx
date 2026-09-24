"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { markRewardsPaid } from "@/lib/actions/partnership-terms";
import { exportToCsv } from "@/lib/export-csv";
import { formatCurrency, formatDate } from "@/lib/format";
import { BadgeCheck, Download, ExternalLink } from "lucide-react";

export type PayoutRow = {
  id: string;
  date: string;
  ambassadorId: string;
  ambassador: string;
  term: string;
  metricValue: number | null;
  metric: string;
  amount: number;
  link: string | null;
  bankAccount: string | null;
  registrationNumber: string | null;
};

// Everything owed to ambassadors in one place — select a batch, export it for
// accounting and mark it paid once the transfer went out.
export function PayoutList({ rows, canEdit }: { rows: PayoutRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const numberFormat = new Intl.NumberFormat("cs-CZ");

  const byAmbassador = useMemo(() => {
    const map = new Map<string, { name: string; bankAccount: string | null; rows: PayoutRow[] }>();
    for (const r of rows) {
      if (!map.has(r.ambassadorId)) map.set(r.ambassadorId, { name: r.ambassador, bankAccount: r.bankAccount, rows: [] });
      map.get(r.ambassadorId)!.rows.push(r);
    }
    return [...map.entries()];
  }, [rows]);

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const selectedSum = selectedRows.reduce((s, r) => s + r.amount, 0);

  function toggle(ids: string[], on: boolean) {
    const next = new Set(selected);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    setSelected(next);
  }

  async function markPaid() {
    if (!confirm(`Označit ${selectedRows.length} odměn (${formatCurrency(selectedSum)}) jako vyplacené?`)) return;
    setBusy(true);
    try {
      const count = await markRewardsPaid(selectedRows.map((r) => r.id));
      toast.success(`Vyplaceno: ${count} odměn.`);
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const source = selectedRows.length ? selectedRows : rows;
    exportToCsv(
      "odmeny-k-vyplate",
      source.map((r) => ({
        Datum: formatDate(r.date),
        Ambasador: r.ambassador,
        IČO: r.registrationNumber ?? "",
        "Číslo účtu": r.bankAccount ?? "",
        Povinnost: r.term,
        [r.metric]: r.metricValue ?? "",
        "Částka (Kč)": r.amount,
        Odkaz: r.link ?? "",
      })),
    );
  }

  if (rows.length === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground border rounded-md border-dashed">Všechny odměny jsou vyplacené.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {selectedRows.length ? `Vybráno ${selectedRows.length} · ${formatCurrency(selectedSum)}` : `Celkem ${formatCurrency(rows.reduce((s, r) => s + r.amount, 0))}`}
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Export pro účetní</Button>
          {canEdit && (
            <Button size="sm" onClick={markPaid} disabled={busy || selectedRows.length === 0}>
              <BadgeCheck className="h-3.5 w-3.5" /> Označit jako vyplacené
            </Button>
          )}
        </div>
      </div>
      {byAmbassador.map(([id, group]) => {
        const ids = group.rows.map((r) => r.id);
        const all = ids.every((x) => selected.has(x));
        return (
          <Card key={id}>
            <CardContent className="py-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {canEdit && <input type="checkbox" className="h-4 w-4 accent-[#FF1947]" checked={all} onChange={(e) => toggle(ids, e.target.checked)} />}
                <Link href={`/crm/ambassadors/${id}`} className="text-sm font-semibold hover:underline">{group.name}</Link>
                <span className="text-xs text-muted-foreground">{group.bankAccount ? `účet ${group.bankAccount}` : "číslo účtu nezadáno"}</span>
                <span className="ml-auto text-sm font-semibold">{formatCurrency(group.rows.reduce((s, r) => s + r.amount, 0))}</span>
              </div>
              {group.rows.map((r) => (
                <label key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs pl-6 cursor-pointer">
                  {canEdit && <input type="checkbox" className="h-3.5 w-3.5 -ml-6 accent-[#FF1947]" checked={selected.has(r.id)} onChange={(e) => toggle([r.id], e.target.checked)} />}
                  <span className="text-muted-foreground w-20">{formatDate(r.date)}</span>
                  <span className="flex-1 min-w-[120px]">{r.term}</span>
                  {r.metricValue != null && <span className="text-muted-foreground">{numberFormat.format(r.metricValue)} {r.metric}</span>}
                  {r.link && (
                    <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <span className="font-medium">{formatCurrency(r.amount)}</span>
                </label>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

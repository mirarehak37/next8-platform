import { History } from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import type { TermView } from "@/components/partnerships/terms-panel";

const ACTION_LABELS: Record<string, string> = {
  create: "vytvořil(a) záznam",
  update: "upravil(a) záznam",
  delete: "smazal(a) záznam",
  term_create: "přidal(a) podmínku",
  term_update: "upravil(a) podmínku",
  term_delete: "smazal(a) podmínku",
  fulfillment_create: "zapsal(a) plnění",
  attachment_create: "nahrál(a) dokument",
  attachment_delete: "smazal(a) dokument",
};

export function AuditHistory({ logs }: { logs: { id: string; createdAt: Date; action: string; changes: string | null; user: { name: string } | null }[] }) {
  if (logs.length === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground border rounded-md border-dashed">Zatím žádná historie změn.</div>;
  }
  return (
    <div>
      {logs.map((log) => {
        let detail: string | null = null;
        if (log.action !== "update" && log.changes) {
          try {
            const parsed = JSON.parse(log.changes) as Record<string, unknown>;
            detail = String(parsed.title ?? parsed.term ?? parsed.fileName ?? "") || null;
          } catch {
            detail = null;
          }
        }
        return (
          <div key={log.id} className="flex items-center gap-3 text-sm py-2 border-b last:border-0">
            <History className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">{formatDateTime(log.createdAt)}</span>
            <span>{log.user?.name ?? "Systém"}</span>
            <span className="text-muted-foreground">{ACTION_LABELS[log.action] ?? log.action}</span>
            {detail && <span className="truncate">„{detail}“</span>}
          </div>
        );
      })}
    </div>
  );
}

// Flat, newest-first ledger of everything logged against the terms — the place to
// answer "what have we paid them this year" and "what have they delivered".
export function FulfillmentLedger({ terms, weGiveLabel, theyGiveLabel }: { terms: TermView[]; weGiveLabel: string; theyGiveLabel: string }) {
  const rows = terms
    .flatMap((t) => t.fulfillments.map((f) => ({ ...f, termTitle: t.title, direction: t.direction })))
    .sort((a, b) => b.date.localeCompare(a.date));
  const year = new Date().getFullYear();
  const paidThisYear = rows
    .filter((r) => r.direction === "we_give" && new Date(r.date).getFullYear() === year)
    .reduce((s, r) => s + (r.amount ?? 0), 0);
  const receivedThisYear = rows
    .filter((r) => r.direction === "they_give" && new Date(r.date).getFullYear() === year)
    .reduce((s, r) => s + (r.amount ?? 0), 0);

  if (rows.length === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground border rounded-md border-dashed">Zatím nic nezapsáno. Plnění se zapisuje u jednotlivých podmínek.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-6 text-sm">
        <div><span className="text-muted-foreground">{weGiveLabel} v roce {year}: </span><span className="font-semibold">{formatCurrency(paidThisYear)}</span></div>
        {receivedThisYear > 0 && (
          <div><span className="text-muted-foreground">{theyGiveLabel} v roce {year}: </span><span className="font-semibold">{formatCurrency(receivedThisYear)}</span></div>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Datum</th>
                  <th className="text-left font-medium px-4 py-2">Podmínka</th>
                  <th className="text-left font-medium px-4 py-2">Směr</th>
                  <th className="text-right font-medium px-4 py-2">Počet</th>
                  <th className="text-right font-medium px-4 py-2">Částka</th>
                  <th className="text-left font-medium px-4 py-2">Poznámka</th>
                  <th className="text-left font-medium px-4 py-2">Zapsal(a)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-4 py-2">{r.termTitle}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{r.direction === "we_give" ? "NEXT8 →" : "→ NEXT8"}</td>
                    <td className="px-4 py-2 text-right">{r.quantity}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">{r.amount ? formatCurrency(r.amount) : "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {r.link ? <a href={r.link} target="_blank" rel="noopener noreferrer" className="underline">{r.note || "odkaz"}</a> : r.note ?? "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{r.recordedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function InfoItem({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <div className="text-muted-foreground text-xs mb-1">{label}</div>
      {children ?? "—"}
    </div>
  );
}

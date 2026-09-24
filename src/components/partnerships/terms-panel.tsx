"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { TermFormDialog } from "@/components/partnerships/term-form-dialog";
import { FulfillmentFormDialog } from "@/components/partnerships/fulfillment-form-dialog";
import { deletePartnershipFulfillment, deletePartnershipTerm } from "@/lib/actions/partnership-terms";
import { isVariableTerm, termProgress, termValueLabel, trailingYear, yearlyValue } from "@/lib/partnerships";
import { findMeta, TERM_PERIODS, termTypes } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ProductOption } from "@/lib/partnership-queries";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp, ExternalLink, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FulfillmentView = {
  id: string;
  date: string;
  quantity: number;
  productName: string | null;
  baseAmount: number | null;
  amount: number | null;
  link: string | null;
  note: string | null;
  recordedBy: string;
};

export type TermView = {
  id: string;
  direction: "we_give" | "they_give";
  type: string;
  title: string;
  description: string | null;
  valueType: string;
  amount: number | null;
  percent: number | null;
  percentBase: string | null;
  productIds: string[];
  quantity: number | null;
  period: string;
  dueDate: string | null;
  isActive: boolean;
  fulfillments: FulfillmentView[];
};

const PERIOD_NOW: Record<string, string> = {
  monthly: "tento měsíc",
  quarterly: "toto čtvrtletí",
  season: "tuto sezónu",
  yearly: "letos",
  one_off: "celkem",
};

export function TermsPanel({
  subjectType,
  subjectId,
  terms,
  canEdit,
  labels,
  products,
}: {
  subjectType: "ambassador" | "partner";
  subjectId: string;
  terms: TermView[];
  canEdit: boolean;
  labels: { weGive: string; theyGive: string };
  products: ProductOption[];
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {(["we_give", "they_give"] as const).map((direction) => {
        const list = terms.filter((t) => t.direction === direction);
        const total = yearlyValue(list, direction);
        const Icon = direction === "we_give" ? ArrowUpRight : ArrowDownLeft;
        return (
          <div key={direction} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <Icon className={cn("h-4 w-4", direction === "we_give" ? "text-rose-500" : "text-emerald-500")} />
                  {direction === "we_give" ? labels.weGive : labels.theyGive}
                </div>
                {total > 0 && (
                  <div className="text-xs text-muted-foreground">Hodnota za rok (odhad): {formatCurrency(total)}</div>
                )}
              </div>
              {canEdit && <TermFormDialog subjectType={subjectType} subjectId={subjectId} direction={direction} products={products} />}
            </div>
            {list.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground border rounded-md border-dashed">Zatím nic nezadáno.</div>
            )}
            {list.map((term) => (
              <TermCard key={term.id} term={term} subjectType={subjectType} subjectId={subjectId} canEdit={canEdit} products={products} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function TermCard({
  term,
  subjectType,
  subjectId,
  canEdit,
  products,
}: {
  term: TermView;
  subjectType: "ambassador" | "partner";
  subjectId: string;
  canEdit: boolean;
  products: ProductOption[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const typeLabel = findMeta(termTypes(subjectType, term.direction), term.type)?.label ?? term.type;
  const period = TERM_PERIODS.find((p) => p.value === term.period);
  const progress = termProgress(term, term.fulfillments);
  const overdue = term.dueDate && new Date(term.dueDate) < new Date() && progress.ratio !== null && progress.ratio < 1;

  async function handleDelete() {
    if (!confirm(`Opravdu smazat podmínku „${term.title}“ včetně její evidence plnění?`)) return;
    try {
      await deletePartnershipTerm(term.id);
      toast.success("Podmínka byla smazána.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  async function handleDeleteFulfillment(id: string) {
    if (!confirm("Smazat tento záznam plnění?")) return;
    try {
      await deletePartnershipFulfillment(id);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  const perPeriod = period && period.value !== "one_off" && period.value !== "per_event" ? ` / ${period.short}` : "";
  const valueLabel = termValueLabel(term, formatCurrency, period?.short);
  const variable = isVariableTerm(term);
  const lastYear = variable ? trailingYear(term.fulfillments) : null;
  const termProducts = products.filter((p) => term.productIds.includes(p.id));

  return (
    <Card className={cn(!term.isActive && "opacity-60")}>
      <CardContent className="py-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{term.title}</span>
              <StatusBadge label={typeLabel} color="slate" />
              {!term.isActive && <StatusBadge label="Neplatí" color="amber" />}
              {overdue && <StatusBadge label="Po termínu" color="rose" />}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {valueLabel ? <span className="font-medium text-foreground">{valueLabel}</span> : null}
              {term.quantity && !variable ? <span>{term.quantity}×{perPeriod}</span> : null}
              {!valueLabel && !(term.quantity && !variable) && period && <span>{period.label}</span>}
              {term.dueDate && <span>Termín: {formatDate(term.dueDate)}</span>}
            </div>
            {termProducts.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {termProducts.map((p) => <StatusBadge key={p.id} label={p.name} color="indigo" />)}
              </div>
            )}
            {term.description && <p className="text-xs text-muted-foreground whitespace-pre-line">{term.description}</p>}
          </div>
          {canEdit && (
            <div className="flex items-center shrink-0">
              <TermFormDialog
                subjectType={subjectType}
                subjectId={subjectId}
                direction={term.direction}
                products={products}
                term={{
                  id: term.id, subjectType, subjectId, direction: term.direction, type: term.type, title: term.title,
                  description: term.description, valueType: term.valueType as "fixed" | "percent", amount: term.amount,
                  percent: term.percent, percentBase: term.percentBase, productIds: term.productIds, quantity: term.quantity, period: term.period,
                  dueDate: term.dueDate?.slice(0, 10) ?? null, isActive: term.isActive,
                }}
                trigger={<Button variant="ghost" size="icon-sm"><Pencil className="h-3.5 w-3.5" /></Button>}
              />
              <Button variant="ghost" size="icon-sm" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          )}
        </div>

        {lastYear && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Za posledních 12 měsíců</span>
            <span className="font-medium">
              {lastYear.count}× · {formatCurrency(lastYear.amount)}
            </span>
          </div>
        )}

        {progress.target ? (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Splněno {PERIOD_NOW[term.period] ?? ""}</span>
              <span className={cn("font-medium", progress.ratio === 1 && "text-emerald-600")}>
                {progress.measuresMoney ? `${formatCurrency(progress.done)} / ${formatCurrency(progress.target)}` : `${progress.done} / ${progress.target}`}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full rounded-full", progress.ratio === 1 ? "bg-emerald-500" : "bg-[#FF1947]")} style={{ width: `${Math.round((progress.ratio ?? 0) * 100)}%` }} />
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          {term.fulfillments.length > 0 ? (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Historie plnění ({term.fulfillments.length})
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">Zatím nic nezapsáno.</span>
          )}
          {canEdit && term.isActive && <FulfillmentFormDialog term={term} products={termProducts.length ? termProducts : products} />}
        </div>

        {expanded && (
          <div className="border-t pt-2 space-y-1">
            {term.fulfillments.map((f) => (
              <div key={f.id} className="flex items-center gap-2 text-xs group">
                <span className="w-24 shrink-0 text-muted-foreground">{formatDate(f.date)}</span>
                <span className="shrink-0">{f.quantity}×</span>
                {f.productName ? <span className="shrink-0">{f.productName}</span> : null}
                {f.baseAmount ? <span className="shrink-0 text-muted-foreground">z {formatCurrency(f.baseAmount)}</span> : null}
                {f.amount ? <span className="shrink-0 font-medium">{formatCurrency(f.amount)}</span> : null}
                <span className="truncate text-muted-foreground">{f.note}</span>
                {f.link && (
                  <a href={f.link} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <span className="ml-auto shrink-0 text-muted-foreground">{f.recordedBy}</span>
                {canEdit && (
                  <button type="button" onClick={() => handleDeleteFulfillment(f.id)} className="shrink-0 text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

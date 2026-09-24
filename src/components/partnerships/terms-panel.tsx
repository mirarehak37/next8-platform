"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { TermFormDialog } from "@/components/partnerships/term-form-dialog";
import { FulfillmentFormDialog } from "@/components/partnerships/fulfillment-form-dialog";
import { PlanDeliveriesDialog } from "@/components/partnerships/plan-deliveries-dialog";
import { deletePartnershipFulfillment, deletePartnershipTerm, updatePartnershipFulfillment } from "@/lib/actions/partnership-terms";
import { hasDeliveryReward, isVariableTerm, termProgress, termValueLabel, trailingYear, yearlyValue, type BonusTier } from "@/lib/partnerships";
import { findMeta, TERM_PERIODS, termTypes } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ProductOption } from "@/lib/partnership-queries";
import { ArrowDownLeft, ArrowUpRight, CalendarClock, Check, ChevronDown, ChevronUp, ExternalLink, Eye, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FulfillmentView = {
  id: string;
  date: string;
  quantity: number;
  productId: string | null;
  productName: string | null;
  baseAmount: number | null;
  metricValue: number | null;
  rewardAmount: number | null;
  paidAt: string | null;
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
  rewardAmount: number | null;
  bonusMetric: string | null;
  bonusTiers: BonusTier[];
  quantity: number | null;
  period: string;
  dueDate: string | null;
  isActive: boolean;
  planned: { id: string; date: string; note: string | null }[];
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

  async function togglePaid(id: string, paid: boolean) {
    try {
      await updatePartnershipFulfillment(id, { paid });
      toast.success(paid ? "Odměna označena jako vyplacená." : "Označení vyplaceno zrušeno.");
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
  const rewarded = term.direction === "they_give" && hasDeliveryReward(term);
  const metric = term.bonusMetric || "zhlédnutí";
  const unpaid = term.fulfillments.filter((f) => f.rewardAmount && !f.paidAt).reduce((sum, f) => sum + (f.rewardAmount ?? 0), 0);
  const numberFormat = new Intl.NumberFormat("cs-CZ");

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
            {rewarded && (
              <div className="text-xs">
                <span className="text-muted-foreground">Odměna: </span>
                <span className="font-medium">
                  {term.rewardAmount ? `${formatCurrency(term.rewardAmount)} za každé splnění` : "jen bonus"}
                </span>
                {term.bonusTiers.map((t) => (
                  <span key={t.threshold} className="text-muted-foreground"> · od {numberFormat.format(t.threshold)} {metric} +{formatCurrency(t.amount)}</span>
                ))}
              </div>
            )}
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
                  rewardAmount: term.rewardAmount, bonusMetric: term.bonusMetric, bonusTiers: term.bonusTiers,
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

        {rewarded && unpaid > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">K výplatě (nevyplaceno)</span>
            <span className="font-semibold text-[#FF1947]">{formatCurrency(unpaid)}</span>
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

        {term.planned.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Naplánováno</div>
            {term.planned.map((p) => {
              const late = new Date(p.date) < new Date(new Date().toDateString());
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <CalendarClock className={cn("h-3 w-3", late ? "text-rose-500" : "text-muted-foreground")} />
                  <span className={cn("font-medium", late && "text-rose-600")}>{formatDate(p.date)}</span>
                  {late && <StatusBadge label="Zpožděno" color="rose" />}
                  {p.note && <span className="truncate text-muted-foreground">{p.note}</span>}
                  {canEdit && (
                    <span className="ml-auto flex items-center gap-1">
                      <FulfillmentFormDialog
                        term={term}
                        products={termProducts.length ? termProducts : products}
                        completing
                        fulfillment={{ id: p.id, date: p.date, quantity: 1, productId: null, baseAmount: null, amount: null, metricValue: null, rewardAmount: null, link: null, note: p.note }}
                        trigger={<Button size="xs" variant="outline"><Check className="h-3 w-3" /> Splněno</Button>}
                      />
                      <button type="button" onClick={() => handleDeleteFulfillment(p.id)} className="text-muted-foreground hover:text-destructive" title="Zrušit termín">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          {term.fulfillments.length > 0 ? (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Historie plnění ({term.fulfillments.length})
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">Zatím nic nezapsáno.</span>
          )}
          {canEdit && term.isActive && (
            <div className="flex items-center gap-1">
              {term.direction === "they_give" && <PlanDeliveriesDialog term={term} />}
              <FulfillmentFormDialog term={term} products={termProducts.length ? termProducts : products} />
            </div>
          )}
        </div>

        {expanded && (
          <div className="border-t pt-2 space-y-1">
            {term.fulfillments.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs group border-b last:border-0 pb-1 sm:border-0 sm:pb-0">
                <span className="sm:w-24 shrink-0 text-muted-foreground">{formatDate(f.date)}</span>
                <span className="shrink-0">{f.quantity}×</span>
                {f.productName ? <span className="shrink-0">{f.productName}</span> : null}
                {f.baseAmount ? <span className="shrink-0 text-muted-foreground">z {formatCurrency(f.baseAmount)}</span> : null}
                {f.amount ? <span className="shrink-0 font-medium">{formatCurrency(f.amount)}</span> : null}
                {f.metricValue != null && (
                  <span className="shrink-0 flex items-center gap-0.5 text-muted-foreground"><Eye className="h-3 w-3" />{numberFormat.format(f.metricValue)}</span>
                )}
                {f.rewardAmount ? (
                  canEdit ? (
                    <button
                      type="button"
                      onClick={() => togglePaid(f.id, !f.paidAt)}
                      title={f.paidAt ? "Vyplaceno — kliknutím zrušíte" : "Kliknutím označíte jako vyplacené"}
                      className="shrink-0"
                    >
                      <StatusBadge label={`${formatCurrency(f.rewardAmount)} · ${f.paidAt ? "vyplaceno" : "k výplatě"}`} color={f.paidAt ? "emerald" : "amber"} />
                    </button>
                  ) : (
                    <StatusBadge label={`${formatCurrency(f.rewardAmount)} · ${f.paidAt ? "vyplaceno" : "k výplatě"}`} color={f.paidAt ? "emerald" : "amber"} className="shrink-0" />
                  )
                ) : null}
                <span className="truncate text-muted-foreground">{f.note}</span>
                {f.link && (
                  <a href={f.link} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <span className="ml-auto shrink-0 text-muted-foreground">{f.recordedBy}</span>
                {canEdit && (
                  <FulfillmentFormDialog
                    term={term}
                    products={termProducts.length ? termProducts : products}
                    fulfillment={f}
                    trigger={<button type="button" className="shrink-0 text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>}
                  />
                )}
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

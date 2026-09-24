"use client";

import * as React from "react";
import { useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { dealSchema, type DealInput } from "@/lib/validations/crm";
import { createDeal, updateDeal } from "@/lib/actions/deals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { FormCombobox } from "@/components/form-combobox";
import { FormCurrencyInput } from "@/components/form-currency-input";
import { Plus, Pencil } from "lucide-react";
import { AMBASSADOR_SOURCE, LEAD_SOURCES } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import type { DealFormExtras } from "@/lib/deal-form-extras";

const CUSTOM = "__custom__";

function periodOf(p: { billingPeriod: string | null; name: string }) {
  if (p.billingPeriod === "yearly" || p.billingPeriod === "monthly") return p.billingPeriod;
  return /ročn|rok|year/i.test(p.name) ? "yearly" : /měsí|mesi|month/i.test(p.name) ? "monthly" : null;
}

type Option = { id: string; name: string };
type Stage = { id: string; name: string };

export function DealFormDialog({
  owners,
  companies,
  contacts = [],
  stages,
  pipelineId,
  deal,
  defaultStageId,
  trigger,
  extras,
}: {
  extras?: DealFormExtras;
  owners: Option[];
  companies: Option[];
  contacts?: Option[];
  stages: Stage[];
  pipelineId: string;
  deal?: (DealInput & { id: string }) | null;
  defaultStageId?: string;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = !!deal;

  const {
    register, handleSubmit, control, formState: { errors, isSubmitting }, reset, setValue, getValues,
  } = useForm<DealInput>({
    resolver: zodResolver(dealSchema),
    defaultValues: deal ?? {
      name: "", ownerId: owners[0]?.id ?? "", pipelineId, stageId: defaultStageId ?? stages[0]?.id ?? "", value: 0,
    },
  });

  const companyId = useWatch({ control, name: "companyId" });
  const productId = useWatch({ control, name: "productId" });
  const customPackage = useWatch({ control, name: "customPackage" });
  const source = useWatch({ control, name: "source" });
  const ambassadorId = useWatch({ control, name: "ambassadorId" });
  const commissionTermId = useWatch({ control, name: "commissionTermId" });
  const value = useWatch({ control, name: "value" });
  const teams = (extras?.teams ?? []).filter((t) => t.companyId === companyId);
  const ambassador = extras?.ambassadors.find((a) => a.id === ambassadorId);
  const term = ambassador?.terms.find((t) => t.id === commissionTermId);
  const viaAmbassador = source === AMBASSADOR_SOURCE;
  const isCustom = !productId && customPackage != null;

  // Deal value = package price minus discount (still editable by hand).
  function recompute(list?: number | null, discount?: number | null) {
    const l = list ?? Number(getValues("listPrice")) ?? 0;
    const d = discount ?? Number(getValues("discountPercent") || 0);
    if (l) setValue("value", Math.round(l * (1 - (d || 0) / 100)));
  }

  async function onSubmit(values: DealInput) {
    const data: DealInput = viaAmbassador ? values : { ...values, ambassadorId: null, commissionTermId: null };
    try {
      if (isEdit) {
        await updateDeal(deal!.id, data);
        toast.success("Obchodní případ byl upraven.");
      } else {
        await createDeal(data);
        toast.success("Obchodní případ byl vytvořen.");
        reset();
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button size="sm"><Plus className="h-4 w-4" /> Nový obchod</Button>} />
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Upravit obchodní případ" : "Nový obchodní případ"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register("pipelineId")} value={pipelineId} />
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Název *</Label>
              <Input {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Klub</Label>
              <Controller control={control} name="companyId" render={({ field }) => <FormCombobox value={field.value} onChange={(v) => { field.onChange(v); setValue("clubTeamId", null); }} options={companies.map((c) => ({ value: c.id, label: c.name }))} placeholder="Bez klubu" allowClear clearLabel="Bez klubu" />} />
            </div>
            {extras && (
              <div className="space-y-1.5">
                <Label>Tým</Label>
                <Controller control={control} name="clubTeamId" render={({ field }) => (
                  <FormCombobox
                    value={field.value}
                    onChange={field.onChange}
                    options={teams.map((t) => ({ value: t.id, label: t.name, hint: t.category }))}
                    placeholder={companyId ? (teams.length ? "Celý klub / vyberte tým" : "Klub nemá týmy") : "Nejdřív vyberte klub"}
                    allowClear
                    clearLabel="Celý klub"
                  />
                )} />
              </div>
            )}
            {extras && (
              <div className="col-span-2 space-y-1.5">
                <Label>Nabízený balíček</Label>
                <FormCombobox
                  value={productId ?? (isCustom ? CUSTOM : null)}
                  onChange={(v) => {
                    if (v === CUSTOM) {
                      setValue("productId", null);
                      setValue("customPackage", getValues("customPackage") ?? "");
                      return;
                    }
                    const p = extras.products.find((x) => x.id === v);
                    setValue("productId", v || null);
                    setValue("customPackage", null);
                    if (p) {
                      setValue("listPrice", p.price);
                      setValue("billingPeriod", periodOf(p));
                      recompute(p.price);
                    }
                  }}
                  options={[
                    ...extras.products.filter((p) => p.isActive || p.id === productId).map((p) => ({ value: p.id, label: p.name, hint: formatCurrency(p.price) })),
                    { value: CUSTOM, label: "Individuální nabídka (vlastní cena)" },
                  ]}
                  placeholder="Vyberte balíček"
                  allowClear
                  clearLabel="Bez balíčku"
                />
              </div>
            )}
            {extras && isCustom && (
              <div className="col-span-2 space-y-1.5">
                <Label>Co nabízíme (individuálně)</Label>
                <Input placeholder="např. TEAM THREE pro celý klub, 3 týmy, 55 hráčů" {...register("customPackage")} />
              </div>
            )}
            {extras && (productId || isCustom) && (
              <>
                <div className="space-y-1.5">
                  <Label>{isCustom ? "Cena" : "Ceníková cena"}</Label>
                  <Controller control={control} name="listPrice" render={({ field }) => (
                    <FormCurrencyInput value={field.value as number | null | undefined} onChange={(v) => { field.onChange(v); recompute(v); }} />
                  )} />
                </div>
                <div className="space-y-1.5">
                  <Label>Sleva %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="např. 15 (referral kód)"
                    {...register("discountPercent", { onChange: (e) => recompute(undefined, Number(e.target.value) || 0) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Platba</Label>
                  <Controller control={control} name="billingPeriod" render={({ field }) => (
                    <FormSelect value={field.value} onChange={field.onChange} options={[{ value: "monthly", label: "Měsíčně" }, { value: "yearly", label: "Ročně" }]} placeholder="Vyberte…" />
                  )} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>{extras && (productId || isCustom) ? "Hodnota (po slevě) *" : "Hodnota *"}</Label>
              <Controller control={control} name="value" render={({ field }) => <FormCurrencyInput value={field.value} onChange={field.onChange} />} />
            </div>
            <div className="space-y-1.5">
              <Label>Fáze</Label>
              <Controller control={control} name="stageId" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={stages.map((s) => ({ value: s.id, label: s.name }))} />} />
            </div>
            <div className="space-y-1.5">
              <Label>Očekávané uzavření</Label>
              <Input type="date" {...register("expectedCloseDate")} />
            </div>
            <div className="space-y-1.5">
              <Label>Kontaktní osoba</Label>
              <Controller control={control} name="primaryContactId" render={({ field }) => <FormCombobox value={field.value} onChange={field.onChange} options={contacts.map((c) => ({ value: c.id, label: c.name }))} placeholder="Bez kontaktu" allowClear clearLabel="Bez kontaktu" />} />
            </div>
            <div className="space-y-1.5">
              <Label>Vlastník *</Label>
              <Controller control={control} name="ownerId" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={owners.map((o) => ({ value: o.id, label: o.name }))} />} />
            </div>
            <div className="space-y-1.5">
              <Label>Zdroj</Label>
              <Controller control={control} name="source" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={LEAD_SOURCES.map((s) => ({ value: s, label: s }))} placeholder="Vyberte…" />} />
            </div>
            {extras && viaAmbassador && (
              <>
                <div className="space-y-1.5">
                  <Label>Ambasador</Label>
                  <Controller control={control} name="ambassadorId" render={({ field }) => (
                    <FormCombobox
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v);
                        // Default to his highest commission (brokered deal beats referral code).
                        setValue("commissionTermId", extras.ambassadors.find((a) => a.id === v)?.terms[0]?.id ?? null);
                      }}
                      options={extras.ambassadors.map((a) => ({ value: a.id, label: a.name, hint: a.discountCode ?? undefined }))}
                      placeholder="Vyberte ambasadora"
                    />
                  )} />
                </div>
                {ambassador && ambassador.terms.length > 0 && (
                  <div className="col-span-2 space-y-1.5">
                    <Label>Provize podle</Label>
                    <Controller control={control} name="commissionTermId" render={({ field }) => (
                      <FormSelect value={field.value} onChange={field.onChange} options={ambassador.terms.map((t) => ({ value: t.id, label: `${t.title} – ${t.percent} %` }))} />
                    )} />
                    {term && (
                      <p className="text-xs text-muted-foreground">
                        Po vyhrání obchodu se ambasadorovi zapíše provize <strong className="text-foreground">{formatCurrency(Math.round((Number(value) || 0) * term.percent) / 100)}</strong> ({term.percent} % z {formatCurrency(Number(value) || 0)}) jako „k výplatě“.
                      </p>
                    )}
                  </div>
                )}
                {ambassador && ambassador.terms.length === 0 && (
                  <p className="col-span-2 text-xs text-amber-600">
                    {ambassador.name} nemá nastavenou procentní provizi. Přidej ji u ambasadora (Co mu platíme → Procenta), jinak se provize nezapíše.{" "}
                    <Link href={`/crm/ambassadors/${ambassador.id}`} className="underline">Otevřít ambasadora</Link>
                  </p>
                )}
              </>
            )}
            <div className="col-span-2 space-y-1.5">
              <Label>Další krok</Label>
              <Input {...register("nextStep")} placeholder="Např. zaslat nabídku" />
            </div>
            <div className="space-y-1.5">
              <Label>Termín dalšího kroku</Label>
              <Input type="date" {...register("nextStepDate")} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Poznámka</Label>
              <Textarea rows={3} {...register("description")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : isEdit ? "Uložit změny" : "Vytvořit obchod"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const DealEditTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>((props, ref) => (
  <Button variant="outline" size="sm" ref={ref} {...props}><Pencil className="h-3.5 w-3.5" /> Upravit</Button>
));
DealEditTrigger.displayName = "DealEditTrigger";

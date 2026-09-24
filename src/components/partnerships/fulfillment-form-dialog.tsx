"use client";

import * as React from "react";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { partnershipFulfillmentSchema, type PartnershipFulfillmentInput } from "@/lib/validations/partnerships";
import { createPartnershipFulfillment, updatePartnershipFulfillment } from "@/lib/actions/partnership-terms";
import { deliveryReward, hasDeliveryReward, type BonusTier } from "@/lib/partnerships";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormCurrencyInput } from "@/components/form-currency-input";
import { Section, Field } from "@/components/partnerships/form-parts";
import { CheckCheck } from "lucide-react";
import { FormCombobox } from "@/components/form-combobox";
import { formatCurrency } from "@/lib/format";
import type { ProductOption } from "@/lib/partnership-queries";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export type FulfillmentEditValues = {
  id: string;
  date: string;
  quantity: number;
  productId?: string | null;
  baseAmount: number | null;
  amount: number | null;
  metricValue: number | null;
  rewardAmount: number | null;
  link: string | null;
  note: string | null;
};

export function FulfillmentFormDialog({
  term,
  products,
  fulfillment,
  trigger,
}: {
  products: ProductOption[];
  fulfillment?: FulfillmentEditValues;
  trigger?: React.ReactElement;
  term: {
    id: string;
    title: string;
    direction: string;
    valueType: string;
    amount: number | null;
    percent: number | null;
    percentBase: string | null;
    quantity: number | null;
    period: string;
    rewardAmount: number | null;
    bonusMetric: string | null;
    bonusTiers: BonusTier[];
  };
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const weGive = term.direction === "we_give";
  const isPercent = term.valueType === "percent" && term.percent != null;
  const isPayout = weGive && (!!term.amount || isPercent);
  // Obligations with a per-piece reward / bonus tiers (reels, posts…).
  const rewarded = !weGive && hasDeliveryReward(term);
  const metric = term.bonusMetric || "zhlédnutí";
  const isEdit = !!fulfillment;
  const blank = (): PartnershipFulfillmentInput => ({
    termId: term.id,
    date: today(),
    quantity: 1,
    productId: null,
    baseAmount: null,
    // A money term without a unit count is usually paid in full each period / per sale.
    amount: !isPercent && term.amount && !term.quantity ? term.amount : null,
    metricValue: null,
    rewardAmount: rewarded ? deliveryReward(term, 1, null).total : null,
  });
  const initial = (): PartnershipFulfillmentInput =>
    fulfillment
      ? {
          termId: term.id,
          date: fulfillment.date.slice(0, 10),
          quantity: fulfillment.quantity,
          productId: fulfillment.productId ?? null,
          baseAmount: fulfillment.baseAmount,
          amount: fulfillment.amount,
          metricValue: fulfillment.metricValue,
          rewardAmount: fulfillment.rewardAmount,
          link: fulfillment.link,
          note: fulfillment.note,
        }
      : blank();

  const {
    register, handleSubmit, control, formState: { errors, isSubmitting }, reset, setValue, getValues,
  } = useForm<PartnershipFulfillmentInput>({
    resolver: zodResolver(partnershipFulfillmentSchema),
    defaultValues: initial(),
  });

  function recomputeReward(quantity: unknown, metricValue: unknown) {
    if (!rewarded) return;
    const views = metricValue === "" || metricValue == null ? null : Number(metricValue);
    setValue("rewardAmount", deliveryReward(term, Number(quantity) || 1, views).total);
  }

  function setBase(value: number) {
    setValue("baseAmount", value);
    // Pre-compute the commission; it stays editable (rounding, refunds…).
    setValue("amount", Math.round(value * term.percent!) / 100);
  }

  async function onSubmit(data: PartnershipFulfillmentInput) {
    try {
      if (isEdit) {
        const { termId: _termId, ...changes } = data;
        void _termId;
        await updatePartnershipFulfillment(fulfillment!.id, changes);
        toast.success("Záznam byl upraven.");
      } else {
        await createPartnershipFulfillment(data);
        toast.success(weGive ? "Plnění bylo zapsáno." : "Splnění bylo zapsáno.");
        reset(blank());
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button size="xs" variant="outline"><CheckCheck className="h-3 w-3" /> {isPayout ? "Zapsat výplatu" : weGive ? "Zapsat plnění" : "Zapsat splnění"}</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{term.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Section title={isPayout ? "Výplata" : weGive ? "Poskytnuté plnění" : "Splněná povinnost"}>
            <Field label="Datum *" error={errors.date?.message}><Input type="date" {...register("date")} /></Field>
            <Field label={isPercent || term.period === "per_event" ? "Počet prodejů" : "Počet"}><Input
                type="number"
                min={1}
                {...register("quantity", {
                  onChange: (e) => {
                    const product = products.find((p) => p.id === getValues("productId"));
                    if (isPercent && product) setBase(product.price * (Number(e.target.value) || 1));
                    recomputeReward(e.target.value, getValues("metricValue"));
                  },
                })}
              /></Field>
            {isPercent && products.length > 0 && (
              <Field label="Prodaný produkt" className="sm:col-span-2">
                <Controller control={control} name="productId" render={({ field }) => (
                  <FormCombobox
                    value={field.value}
                    onChange={(id) => {
                      field.onChange(id || null);
                      const product = products.find((p) => p.id === id);
                      // Several sold units of the same package → base = price × count.
                      if (product) setBase(product.price * (Number(getValues("quantity")) || 1));
                    }}
                    options={products.filter((p) => p.isActive).map((p) => ({ value: p.id, label: p.name, hint: formatCurrency(p.price) }))}
                    placeholder="Vyberte produkt"
                    allowClear
                  />
                )} />
              </Field>
            )}
            {isPercent && (
              <Field label={`Částka prodeje${term.percentBase ? ` (${term.percentBase})` : ""}`} className="sm:col-span-2">
                <Controller control={control} name="baseAmount" render={({ field }) => (
                  <FormCurrencyInput value={field.value as number | null | undefined} onChange={setBase} />
                )} />
              </Field>
            )}
            {rewarded ? (
              <>
                {term.bonusTiers.length > 0 && (
                  <Field label={`Počet ${metric}`}>
                    <Input
                      type="number"
                      min={0}
                      placeholder="lze doplnit později"
                      {...register("metricValue", { onChange: (e) => recomputeReward(getValues("quantity"), e.target.value) })}
                    />
                  </Field>
                )}
                <Field label="Odměna k výplatě (vč. bonusu)" className={term.bonusTiers.length ? undefined : "sm:col-span-2"}>
                  <Controller control={control} name="rewardAmount" render={({ field }) => (
                    <FormCurrencyInput value={field.value as number | null | undefined} onChange={field.onChange} />
                  )} />
                </Field>
                {term.bonusTiers.length > 0 && (
                  <p className="sm:col-span-2 text-xs text-muted-foreground">
                    {term.rewardAmount ? `${formatCurrency(term.rewardAmount)} za kus` : "Bez základní odměny"}
                    {term.bonusTiers.map((t) => ` · od ${new Intl.NumberFormat("cs-CZ").format(t.threshold)} ${metric} +${formatCurrency(t.amount)}`).join("")}
                  </p>
                )}
              </>
            ) : (
              <Field label={isPercent ? `Provize (${term.percent} %)` : "Částka"} className="sm:col-span-2">
                <Controller control={control} name="amount" render={({ field }) => (
                  <FormCurrencyInput value={field.value as number | null | undefined} onChange={field.onChange} />
                )} />
              </Field>
            )}
            {!weGive && (
              <Field label="Odkaz (příspěvek, fotky…)" className="sm:col-span-2">
                <Input type="url" placeholder="https://instagram.com/p/…" {...register("link")} />
              </Field>
            )}
            <Field label="Poznámka" className="sm:col-span-2"><Textarea rows={2} {...register("note")} /></Field>
          </Section>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : isEdit ? "Uložit" : "Zapsat"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

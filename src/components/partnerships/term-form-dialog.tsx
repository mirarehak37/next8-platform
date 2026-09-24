"use client";

import * as React from "react";
import { useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { partnershipTermSchema, type PartnershipTermInput } from "@/lib/validations/partnerships";
import { createPartnershipTerm, updatePartnershipTerm } from "@/lib/actions/partnership-terms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { FormCurrencyInput } from "@/components/form-currency-input";
import { Section, Field } from "@/components/partnerships/form-parts";
import { Plus } from "lucide-react";
import { TERM_PERIODS, TERM_VALUE_TYPES, termTypes } from "@/lib/constants";

export function TermFormDialog({
  subjectType,
  subjectId,
  direction,
  term,
  trigger,
}: {
  subjectType: "ambassador" | "partner";
  subjectId: string;
  direction: "we_give" | "they_give";
  term?: (PartnershipTermInput & { id: string }) | null;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = !!term;
  const types = termTypes(subjectType, direction);
  const blank: PartnershipTermInput = { subjectType, subjectId, direction, type: types[0].value, title: "", valueType: "fixed", period: "one_off", isActive: true };

  const {
    register, handleSubmit, control, formState: { errors, isSubmitting }, reset, getValues, setValue, setError,
  } = useForm<PartnershipTermInput>({
    resolver: zodResolver(partnershipTermSchema),
    defaultValues: term ?? blank,
  });
  const valueType = useWatch({ control, name: "valueType" });
  const period = useWatch({ control, name: "period" });
  const isPercent = valueType === "percent";

  async function onSubmit(values: PartnershipTermInput) {
    // Keep only the value fields that match the chosen kind of reward.
    if (isPercent && (values.percent === null || values.percent === undefined || values.percent === "")) {
      setError("percent", { message: "Zadejte procento" });
      return;
    }
    const data: PartnershipTermInput = isPercent
      ? { ...values, amount: null, quantity: null }
      : { ...values, percent: null, percentBase: null, ...(values.period === "per_event" && { quantity: null }) };
    try {
      if (isEdit) {
        await updatePartnershipTerm(term!.id, data);
        toast.success("Podmínka byla upravena.");
      } else {
        await createPartnershipTerm(data);
        toast.success("Podmínka byla přidána.");
        reset(blank);
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button size="sm" variant="outline"><Plus className="h-4 w-4" /> Přidat</Button>} />
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Upravit podmínku" : direction === "we_give" ? "Co poskytujeme (odměna, produkty…)" : "Co musí splnit (povinnost)"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Section title="Podmínka">
            <Field label="Typ">
              <Controller control={control} name="type" render={({ field }) => (
                <FormSelect
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    // Pre-fill the title from the type so a quick entry needs just one pick.
                    const label = types.find((t) => t.value === v)?.label;
                    if (label && !getValues("title")) setValue("title", label);
                  }}
                  options={types.map((t) => ({ value: t.value, label: t.label }))}
                />
              )} />
            </Field>
            <Field label="Opakování">
              <Controller control={control} name="period" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={TERM_PERIODS.map((p) => ({ value: p.value, label: p.label }))} />
              )} />
            </Field>
            <Field label="Název *" error={errors.title?.message} className="sm:col-span-2">
              <Input placeholder={direction === "we_give" ? "např. Měsíční odměna" : "např. 4 příspěvky na Instagramu"} {...register("title")} />
            </Field>
            <Field label="Hodnota" className="sm:col-span-2">
              <Controller control={control} name="valueType" render={({ field }) => (
                <div className="grid grid-cols-2 gap-1 rounded-lg border p-1">
                  {TERM_VALUE_TYPES.map((vt) => (
                    <button
                      key={vt.value}
                      type="button"
                      onClick={() => {
                        field.onChange(vt.value);
                        // A commission is paid when a sale happens, not on a schedule.
                        if (vt.value === "percent" && getValues("period") === "one_off") setValue("period", "per_event");
                      }}
                      className={`rounded-md px-2 py-1.5 text-sm transition-colors ${field.value === vt.value ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:bg-muted"}`}
                    >
                      {vt.label}
                    </button>
                  ))}
                </div>
              )} />
            </Field>
            {isPercent ? (
              <>
                <Field label="Procento *" error={errors.percent?.message}>
                  <div className="relative">
                    <Input type="number" step="0.1" min={0} max={100} placeholder="např. 15" className="pr-7" {...register("percent")} />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                </Field>
                <Field label="Z čeho">
                  <Input placeholder="např. předplatného aplikace" {...register("percentBase")} />
                </Field>
              </>
            ) : (
              <>
                <Field label={period === "per_event" ? "Částka za každý prodej" : direction === "we_give" ? "Částka (za období)" : "Hodnota v Kč (za období)"}>
                  <Controller control={control} name="amount" render={({ field }) => (
                    <FormCurrencyInput value={field.value as number | null | undefined} onChange={field.onChange} />
                  )} />
                </Field>
                {period !== "per_event" && (
                  <Field label="Počet (za období)">
                    <Input type="number" min={0} placeholder="např. 4" {...register("quantity")} />
                  </Field>
                )}
              </>
            )}
            <Field label="Termín splnění">
              <Input type="date" {...register("dueDate")} />
            </Field>
            <div className="flex items-center gap-2 pt-6">
              <Controller control={control} name="isActive" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
              <Label>Platí</Label>
            </div>
            <Field label="Podrobnosti / podmínky" className="sm:col-span-2">
              <Textarea rows={3} placeholder="Přesné znění, hashtagy, označení @next8, kdy se vyplácí…" {...register("description")} />
            </Field>
          </Section>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : isEdit ? "Uložit změny" : "Přidat podmínku"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

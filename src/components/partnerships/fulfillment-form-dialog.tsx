"use client";

import * as React from "react";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { partnershipFulfillmentSchema, type PartnershipFulfillmentInput } from "@/lib/validations/partnerships";
import { createPartnershipFulfillment } from "@/lib/actions/partnership-terms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormCurrencyInput } from "@/components/form-currency-input";
import { Section, Field } from "@/components/partnerships/form-parts";
import { CheckCheck } from "lucide-react";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function FulfillmentFormDialog({
  term,
}: {
  term: { id: string; title: string; direction: string; amount: number | null; quantity: number | null };
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const weGive = term.direction === "we_give";
  const isPayout = weGive && !!term.amount;
  const blank = (): PartnershipFulfillmentInput => ({
    termId: term.id,
    date: today(),
    quantity: 1,
    // A money term without a unit count is usually paid in full each period.
    amount: term.amount && !term.quantity ? term.amount : null,
  });

  const {
    register, handleSubmit, control, formState: { errors, isSubmitting }, reset,
  } = useForm<PartnershipFulfillmentInput>({
    resolver: zodResolver(partnershipFulfillmentSchema),
    defaultValues: blank(),
  });

  async function onSubmit(data: PartnershipFulfillmentInput) {
    try {
      await createPartnershipFulfillment(data);
      toast.success(weGive ? "Plnění bylo zapsáno." : "Splnění bylo zapsáno.");
      reset(blank());
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="xs" variant="outline"><CheckCheck className="h-3 w-3" /> {isPayout ? "Zapsat výplatu" : weGive ? "Zapsat plnění" : "Zapsat splnění"}</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{term.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Section title={isPayout ? "Výplata" : weGive ? "Poskytnuté plnění" : "Splněná povinnost"}>
            <Field label="Datum *" error={errors.date?.message}><Input type="date" {...register("date")} /></Field>
            <Field label="Počet"><Input type="number" min={1} {...register("quantity")} /></Field>
            <Field label="Částka" className="sm:col-span-2">
              <Controller control={control} name="amount" render={({ field }) => (
                <FormCurrencyInput value={field.value as number | null | undefined} onChange={field.onChange} />
              )} />
            </Field>
            {!weGive && (
              <Field label="Odkaz (příspěvek, fotky…)" className="sm:col-span-2">
                <Input type="url" placeholder="https://instagram.com/p/…" {...register("link")} />
              </Field>
            )}
            <Field label="Poznámka" className="sm:col-span-2"><Textarea rows={2} {...register("note")} /></Field>
          </Section>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : "Zapsat"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

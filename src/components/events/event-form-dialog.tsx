"use client";

import * as React from "react";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { eventSchema, type EventInput } from "@/lib/validations/events";
import { createEvent, updateEvent } from "@/lib/actions/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { FormCombobox } from "@/components/form-combobox";
import { FormCurrencyInput } from "@/components/form-currency-input";
import { Section, Field } from "@/components/partnerships/form-parts";
import { EVENT_STATUSES, EVENT_TYPES } from "@/lib/constants";
import { Plus } from "lucide-react";

type Option = { id: string; name: string };

export function EventFormDialog({
  event,
  owners,
  companies,
  currentUserId,
  trigger,
}: {
  event?: (EventInput & { id: string }) | null;
  owners: Option[];
  companies: Option[];
  currentUserId?: string;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = !!event;
  const blank: EventInput = { name: "", type: "camp", status: "planned", startDate: "", ownerId: currentUserId ?? owners[0]?.id ?? "" };

  const {
    register, handleSubmit, control, formState: { errors, isSubmitting }, reset,
  } = useForm<EventInput>({ resolver: zodResolver(eventSchema), defaultValues: event ?? blank });

  async function onSubmit(data: EventInput) {
    try {
      if (isEdit) {
        await updateEvent(event!.id, data);
        toast.success("Akce byla upravena.");
        setOpen(false);
        router.refresh();
      } else {
        const created = await createEvent(data);
        toast.success("Akce byla vytvořena.");
        reset(blank);
        setOpen(false);
        router.push(`/events/${created.id}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button size="sm"><Plus className="h-4 w-4" /> Nová akce</Button>} />
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Upravit akci" : "Nová akce / kemp"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Section title="Akce">
            <Field label="Název *" error={errors.name?.message} className="sm:col-span-2"><Input placeholder="např. Letní kemp NEXT8 2027" {...register("name")} /></Field>
            <Field label="Typ">
              <Controller control={control} name="type" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={EVENT_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
              )} />
            </Field>
            <Field label="Stav">
              <Controller control={control} name="status" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={EVENT_STATUSES.map((t) => ({ value: t.value, label: t.label }))} />
              )} />
            </Field>
            <Field label="Začátek *" error={errors.startDate?.message}><Input type="date" {...register("startDate")} /></Field>
            <Field label="Konec"><Input type="date" {...register("endDate")} /></Field>
            <Field label="Místo" className="sm:col-span-2"><Input placeholder="např. Sportovní hala Chodov, Praha" {...register("location")} /></Field>
            <Field label="Pořádající / partnerský klub" className="sm:col-span-2">
              <Controller control={control} name="companyId" render={({ field }) => (
                <FormCombobox value={field.value} onChange={field.onChange} options={companies.map((c) => ({ value: c.id, label: c.name }))} placeholder="Bez klubu" allowClear />
              )} />
            </Field>
          </Section>
          <Section title="Kapacita a cena">
            <Field label="Kapacita (účastníků)"><Input type="number" min={0} placeholder="např. 40" {...register("capacity")} /></Field>
            <Field label="Cena za účastníka">
              <Controller control={control} name="price" render={({ field }) => (
                <FormCurrencyInput value={field.value as number | null | undefined} onChange={field.onChange} placeholder="0 = zdarma" />
              )} />
            </Field>
            <Field label="Vlastník *" error={errors.ownerId?.message}>
              <Controller control={control} name="ownerId" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={owners.map((o) => ({ value: o.id, label: o.name }))} />
              )} />
            </Field>
            <Field label="Popis / program" className="sm:col-span-2"><Textarea rows={3} {...register("description")} /></Field>
          </Section>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : isEdit ? "Uložit změny" : "Vytvořit akci"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ambassadorSchema, type AmbassadorInput } from "@/lib/validations/partnerships";
import { createAmbassador, updateAmbassador } from "@/lib/actions/ambassadors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { FormCombobox } from "@/components/form-combobox";
import { Plus } from "lucide-react";
import { Section, Field } from "@/components/partnerships/form-parts";
import { AMBASSADOR_BILLING_TYPES, AMBASSADOR_POSITIONS, AMBASSADOR_TIERS, PARTNERSHIP_STATUSES, SPORTS } from "@/lib/constants";

type Option = { id: string; name: string };

export function AmbassadorFormDialog({
  ambassador,
  owners,
  companies,
  contacts,
  currentUserId,
  trigger,
}: {
  ambassador?: (AmbassadorInput & { id: string }) | null;
  owners: Option[];
  companies: Option[];
  contacts: Option[];
  currentUserId?: string;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = !!ambassador;

  const {
    register, handleSubmit, control, formState: { errors, isSubmitting }, reset,
  } = useForm<AmbassadorInput>({
    resolver: zodResolver(ambassadorSchema),
    defaultValues: ambassador ?? { firstName: "", lastName: "", status: "candidate", sport: "Florbal", ownerId: currentUserId ?? owners[0]?.id ?? "" },
  });

  async function onSubmit(data: AmbassadorInput) {
    try {
      if (isEdit) {
        await updateAmbassador(ambassador!.id, data);
        toast.success("Ambasador byl upraven.");
      } else {
        const created = await createAmbassador(data);
        toast.success("Ambasador byl vytvořen.");
        reset();
        setOpen(false);
        router.push(`/crm/ambassadors/${created.id}`);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button size="sm"><Plus className="h-4 w-4" /> Nový ambasador</Button>} />
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Upravit ambasadora" : "Nový ambasador"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Section title="Osobní údaje">
            <Field label="Jméno *" error={errors.firstName?.message}><Input {...register("firstName")} /></Field>
            <Field label="Příjmení *" error={errors.lastName?.message}><Input {...register("lastName")} /></Field>
            <Field label="Přezdívka"><Input {...register("nickname")} /></Field>
            <Field label="Datum narození"><Input type="date" {...register("birthDate")} /></Field>
            <Field label="E-mail" error={errors.email?.message}><Input type="email" {...register("email")} /></Field>
            <Field label="Telefon"><Input {...register("phone")} /></Field>
            <Field label="Propojený kontakt v CRM">
              <Controller control={control} name="contactId" render={({ field }) => (
                <FormCombobox value={field.value} onChange={field.onChange} options={contacts.map((c) => ({ value: c.id, label: c.name }))} placeholder="Bez kontaktu" allowClear />
              )} />
            </Field>
          </Section>

          <Section title="Sport a sociální sítě">
            <Field label="Sport">
              <Controller control={control} name="sport" render={({ field }) => (
                <FormCombobox value={field.value} onChange={field.onChange} options={SPORTS.map((s) => ({ value: s, label: s }))} placeholder="Vyberte sport" creatable allowClear />
              )} />
            </Field>
            <Field label="Pozice / role">
              <Controller control={control} name="position" render={({ field }) => (
                <FormCombobox value={field.value} onChange={field.onChange} options={AMBASSADOR_POSITIONS.map((s) => ({ value: s, label: s }))} placeholder="Vyberte pozici" creatable allowClear />
              )} />
            </Field>
            <Field label="Klub" className="sm:col-span-2">
              <Controller control={control} name="companyId" render={({ field }) => (
                <FormCombobox value={field.value} onChange={field.onChange} options={companies.map((c) => ({ value: c.id, label: c.name }))} placeholder="Bez klubu" allowClear />
              )} />
            </Field>
            <Field label="Instagram"><Input placeholder="@uzivatel" {...register("instagram")} /></Field>
            <Field label="TikTok"><Input placeholder="@uzivatel" {...register("tiktok")} /></Field>
            <Field label="YouTube"><Input {...register("youtube")} /></Field>
            <Field label="Počet sledujících (celkem)"><Input type="number" min={0} {...register("followers")} /></Field>
          </Section>

          <Section title="Spolupráce a smlouva">
            <Field label="Stav">
              <Controller control={control} name="status" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={PARTNERSHIP_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
              )} />
            </Field>
            <Field label="Úroveň">
              <Controller control={control} name="tier" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={AMBASSADOR_TIERS.map((s) => ({ value: s.value, label: s.label }))} placeholder="Neurčeno" />
              )} />
            </Field>
            <Field label="Smlouva od"><Input type="date" {...register("contractStart")} /></Field>
            <Field label="Smlouva do"><Input type="date" {...register("contractEnd")} /></Field>
            <Field label="Slevový kód"><Input placeholder="např. PETR10" {...register("discountCode")} /></Field>
            <Field label="Způsob vyplácení">
              <Controller control={control} name="billingType" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={AMBASSADOR_BILLING_TYPES.map((s) => ({ value: s.value, label: s.label }))} placeholder="Neurčeno" />
              )} />
            </Field>
            <Field label="IČO"><Input {...register("registrationNumber")} /></Field>
            <Field label="Číslo účtu"><Input {...register("bankAccount")} /></Field>
            <Field label="Vlastník *" error={errors.ownerId?.message}>
              <Controller control={control} name="ownerId" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={owners.map((o) => ({ value: o.id, label: o.name }))} />
              )} />
            </Field>
            <Field label="Poznámka" className="sm:col-span-2"><Textarea rows={3} {...register("notes")} /></Field>
          </Section>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : isEdit ? "Uložit změny" : "Vytvořit ambasadora"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

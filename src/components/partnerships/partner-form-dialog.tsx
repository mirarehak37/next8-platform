"use client";

import * as React from "react";
import { useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { partnerSchema, type PartnerInput } from "@/lib/validations/partnerships";
import { createPartner, updatePartner } from "@/lib/actions/partners";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { FormCombobox } from "@/components/form-combobox";
import { Plus } from "lucide-react";
import { Section, Field } from "@/components/partnerships/form-parts";
import { PARTNER_KINDS, PARTNER_LEVELS, PARTNERSHIP_STATUSES } from "@/lib/constants";

type Option = { id: string; name: string };

export function PartnerFormDialog({
  partner,
  owners,
  companies,
  contacts,
  currentUserId,
  trigger,
}: {
  partner?: (PartnerInput & { id: string }) | null;
  owners: Option[];
  companies: Option[];
  contacts: Option[];
  currentUserId?: string;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = !!partner;

  const {
    register, handleSubmit, control, formState: { errors, isSubmitting }, reset,
  } = useForm<PartnerInput>({
    resolver: zodResolver(partnerSchema),
    defaultValues: partner ?? { name: "", kind: "next8_partner", status: "negotiation", ownerId: currentUserId ?? owners[0]?.id ?? "" },
  });
  const kind = useWatch({ control, name: "kind" });

  async function onSubmit(values: PartnerInput) {
    // Only a club sponsor is tied to a club; drop a stale pick if the type was switched.
    const data = values.kind === "club_sponsor" ? values : { ...values, companyId: null };
    try {
      if (isEdit) {
        await updatePartner(partner!.id, data);
        toast.success("Partner byl upraven.");
      } else {
        const created = await createPartner(data);
        toast.success("Partner byl vytvořen.");
        reset();
        setOpen(false);
        router.push(`/crm/partners/${created.id}`);
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
      <DialogTrigger render={trigger ?? <Button size="sm"><Plus className="h-4 w-4" /> Nový partner</Button>} />
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Upravit partnera" : "Nový partner / sponzor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Section title="Partner">
            <Field label="Název *" error={errors.name?.message} className="sm:col-span-2"><Input {...register("name")} /></Field>
            <Field label="Typ partnerství">
              <Controller control={control} name="kind" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={PARTNER_KINDS.map((k) => ({ value: k.value, label: k.label }))} />
              )} />
            </Field>
            <Field label="Úroveň partnerství">
              <Controller control={control} name="level" render={({ field }) => (
                <FormCombobox value={field.value} onChange={field.onChange} options={PARTNER_LEVELS.map((l) => ({ value: l, label: l }))} placeholder="Vyberte úroveň" creatable allowClear />
              )} />
            </Field>
            {kind === "club_sponsor" && (
              <Field label="Sponzorovaný klub" className="sm:col-span-2">
                <Controller control={control} name="companyId" render={({ field }) => (
                  <FormCombobox value={field.value} onChange={field.onChange} options={companies.map((c) => ({ value: c.id, label: c.name }))} placeholder="Vyberte klub" allowClear />
                )} />
              </Field>
            )}
            <Field label="IČO"><Input {...register("registrationNumber")} /></Field>
            <Field label="Web"><Input placeholder="www.firma.cz" {...register("website")} /></Field>
            <Field label="E-mail" error={errors.email?.message}><Input type="email" {...register("email")} /></Field>
            <Field label="Telefon"><Input {...register("phone")} /></Field>
            <Field label="Kontaktní osoba" className="sm:col-span-2">
              <Controller control={control} name="contactId" render={({ field }) => (
                <FormCombobox value={field.value} onChange={field.onChange} options={contacts.map((c) => ({ value: c.id, label: c.name }))} placeholder="Vyberte kontakt" allowClear />
              )} />
            </Field>
          </Section>

          <Section title="Smlouva">
            <Field label="Stav">
              <Controller control={control} name="status" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={PARTNERSHIP_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
              )} />
            </Field>
            <Field label="Vlastník *" error={errors.ownerId?.message}>
              <Controller control={control} name="ownerId" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={owners.map((o) => ({ value: o.id, label: o.name }))} />
              )} />
            </Field>
            <Field label="Smlouva od"><Input type="date" {...register("contractStart")} /></Field>
            <Field label="Smlouva do"><Input type="date" {...register("contractEnd")} /></Field>
            <Field label="Poznámka" className="sm:col-span-2"><Textarea rows={3} {...register("notes")} /></Field>
          </Section>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : isEdit ? "Uložit změny" : "Vytvořit partnera"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

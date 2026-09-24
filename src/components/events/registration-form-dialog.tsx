"use client";

import { useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { registrationSchema, type RegistrationInput } from "@/lib/validations/events";
import { createRegistration } from "@/lib/actions/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { FormCombobox } from "@/components/form-combobox";
import { FormCurrencyInput } from "@/components/form-currency-input";
import { Section, Field } from "@/components/partnerships/form-parts";
import { PAYMENT_STATUSES, REGISTRATION_ROLES, REGISTRATION_STATUSES } from "@/lib/constants";
import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string };
type Source = "contact" | "ambassador" | "new";

export function RegistrationFormDialog({
  eventId,
  price,
  contacts,
  ambassadors,
  companies,
}: {
  eventId: string;
  price: number | null;
  contacts: Option[];
  ambassadors: Option[];
  companies: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<Source>("contact");
  const router = useRouter();
  const blank: RegistrationInput = { eventId, role: "participant", status: "registered", paymentStatus: price ? "unpaid" : "free", amount: price };

  const {
    register, handleSubmit, control, formState: { errors, isSubmitting }, reset, setValue,
  } = useForm<RegistrationInput>({ resolver: zodResolver(registrationSchema), defaultValues: blank });
  const role = useWatch({ control, name: "role" });

  function pickSource(s: Source) {
    setSource(s);
    setValue("contactId", null);
    setValue("ambassadorId", null);
    // Ambassadors come as guests, free of charge.
    if (s === "ambassador") {
      setValue("role", "guest");
      setValue("paymentStatus", "free");
      setValue("amount", null);
    }
  }

  async function onSubmit(values: RegistrationInput) {
    const data = {
      ...values,
      contactId: source === "contact" ? values.contactId : null,
      ambassadorId: source === "ambassador" ? values.ambassadorId : null,
    };
    try {
      await createRegistration(data);
      toast.success("Přihláška byla přidána.");
      reset(blank);
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><UserPlus className="h-4 w-4" /> Přidat přihlášku</Button>} />
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nová přihláška</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-3 gap-1 rounded-lg border p-1">
            {([["contact", "Kontakt z CRM"], ["ambassador", "Ambasador"], ["new", "Nový účastník"]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => pickSource(value)}
                className={cn("rounded-md px-2 py-1.5 text-xs sm:text-sm transition-colors", source === value ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:bg-muted")}
              >
                {label}
              </button>
            ))}
          </div>
          <Section title="Kdo">
            {source === "contact" && (
              <Field label="Kontakt *" className="sm:col-span-2">
                <Controller control={control} name="contactId" render={({ field }) => (
                  <FormCombobox value={field.value} onChange={field.onChange} options={contacts.map((c) => ({ value: c.id, label: c.name }))} placeholder="Vyberte kontakt" />
                )} />
              </Field>
            )}
            {source === "ambassador" && (
              <Field label="Ambasador *" className="sm:col-span-2">
                <Controller control={control} name="ambassadorId" render={({ field }) => (
                  <FormCombobox value={field.value} onChange={field.onChange} options={ambassadors.map((c) => ({ value: c.id, label: c.name }))} placeholder="Vyberte ambasadora" />
                )} />
              </Field>
            )}
            {source === "new" && (
              <>
                <Field label="Jméno a příjmení *" className="sm:col-span-2"><Input {...register("name")} /></Field>
                <Field label="E-mail" error={errors.email?.message}><Input type="email" {...register("email")} /></Field>
                <Field label="Telefon"><Input {...register("phone")} /></Field>
              </>
            )}
            <Field label="Klub" className="sm:col-span-2">
              <Controller control={control} name="companyId" render={({ field }) => (
                <FormCombobox value={field.value} onChange={field.onChange} options={companies.map((c) => ({ value: c.id, label: c.name }))} placeholder={source === "contact" ? "Podle kontaktu" : "Bez klubu"} allowClear />
              )} />
            </Field>
          </Section>
          <Section title="Přihláška">
            <Field label="Role">
              <Controller control={control} name="role" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={REGISTRATION_ROLES.map((r) => ({ value: r.value, label: r.label }))} />
              )} />
            </Field>
            <Field label="Stav">
              <Controller control={control} name="status" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={REGISTRATION_STATUSES.map((r) => ({ value: r.value, label: r.label }))} />
              )} />
            </Field>
            {role === "participant" && (
              <>
                <Field label="Platba">
                  <Controller control={control} name="paymentStatus" render={({ field }) => (
                    <FormSelect value={field.value} onChange={field.onChange} options={PAYMENT_STATUSES.map((r) => ({ value: r.value, label: r.label }))} />
                  )} />
                </Field>
                <Field label="Částka">
                  <Controller control={control} name="amount" render={({ field }) => (
                    <FormCurrencyInput value={field.value as number | null | undefined} onChange={field.onChange} />
                  )} />
                </Field>
              </>
            )}
            <Field label="Poznámka" className="sm:col-span-2"><Textarea rows={2} placeholder="Ročník, post, alergie, velikost trika…" {...register("note")} /></Field>
          </Section>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : "Přidat"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

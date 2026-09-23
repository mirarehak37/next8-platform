"use client";

import * as React from "react";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { contactSchema, type ContactInput } from "@/lib/validations/crm";
import { createContact, updateContact } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { FormCombobox } from "@/components/form-combobox";
import { Plus, Pencil } from "lucide-react";
import { CONTACT_STATUSES, LEAD_SOURCES } from "@/lib/constants";

type Option = { id: string; name: string };

export function ContactFormDialog({
  owners,
  companies,
  contact,
  defaultCompanyId,
  trigger,
}: {
  owners: Option[];
  companies: Option[];
  contact?: (ContactInput & { id: string }) | null;
  defaultCompanyId?: string;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = !!contact;

  const {
    register, handleSubmit, control, formState: { errors, isSubmitting }, reset,
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: contact ?? {
      firstName: "", lastName: "", status: "active", ownerId: owners[0]?.id ?? "", companyId: defaultCompanyId ?? null,
      gdprConsent: false, marketingConsent: false,
    },
  });

  async function onSubmit(data: ContactInput) {
    try {
      if (isEdit) {
        await updateContact(contact!.id, data);
        toast.success("Kontakt byl upraven.");
      } else {
        await createContact(data);
        toast.success("Kontakt byl vytvořen.");
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
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus className="h-4 w-4" /> Nový kontakt
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Upravit kontakt" : "Nový kontakt"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Jméno *</Label>
              <Input {...register("firstName")} />
              {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Příjmení *</Label>
              <Input {...register("lastName")} />
              {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Pozice</Label>
              <Input {...register("jobTitle")} />
            </div>
            <div className="space-y-1.5">
              <Label>Oddělení</Label>
              <Input {...register("department")} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" {...register("email")} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input type="tel" {...register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label>Mobil</Label>
              <Input type="tel" {...register("mobile")} />
            </div>
            <div className="space-y-1.5">
              <Label>Zdroj</Label>
              <Controller
                control={control}
                name="source"
                render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={LEAD_SOURCES.map((s) => ({ value: s, label: s }))} />}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Firma</Label>
              <Controller
                control={control}
                name="companyId"
                render={({ field }) => (
                  <FormCombobox value={field.value} onChange={field.onChange} options={companies.map((c) => ({ value: c.id, label: c.name }))} placeholder="Bez firmy" allowClear clearLabel="Bez firmy" />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Stav</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={CONTACT_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vlastník *</Label>
              <Controller
                control={control}
                name="ownerId"
                render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={owners.map((o) => ({ value: o.id, label: o.name }))} />}
              />
            </div>
            <div className="col-span-2 flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <Controller control={control} name="gdprConsent" render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} />} />
                GDPR souhlas
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Controller control={control} name="marketingConsent" render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} />} />
                Marketingový souhlas
              </label>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Poznámka</Label>
              <Textarea rows={3} {...register("description")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Ukládám…" : isEdit ? "Uložit změny" : "Vytvořit kontakt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const ContactEditTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>((props, ref) => (
  <Button variant="outline" size="sm" ref={ref} {...props}>
    <Pencil className="h-3.5 w-3.5" /> Upravit
  </Button>
));
ContactEditTrigger.displayName = "ContactEditTrigger";

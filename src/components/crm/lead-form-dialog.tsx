"use client";

import * as React from "react";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { leadSchema, type LeadInput } from "@/lib/validations/crm";
import { createLead, updateLead } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { FormCurrencyInput } from "@/components/form-currency-input";
import { Plus, Pencil } from "lucide-react";
import { LEAD_STATUSES, LEAD_RATINGS, LEAD_SOURCES } from "@/lib/constants";

type Owner = { id: string; name: string };

export function LeadFormDialog({ owners, lead, trigger }: { owners: Owner[]; lead?: (LeadInput & { id: string }) | null; trigger?: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = !!lead;

  const {
    register, handleSubmit, control, formState: { errors, isSubmitting }, reset,
  } = useForm<LeadInput>({
    resolver: zodResolver(leadSchema),
    defaultValues: lead ?? { status: "new", ownerId: owners[0]?.id ?? "" },
  });

  async function onSubmit(data: LeadInput) {
    try {
      if (isEdit) {
        await updateLead(lead!.id, data);
        toast.success("Lead byl upraven.");
      } else {
        await createLead(data);
        toast.success("Lead byl vytvořen.");
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
      <DialogTrigger render={trigger ?? <Button size="sm"><Plus className="h-4 w-4" /> Nový lead</Button>} />
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Upravit lead" : "Nový lead"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Jméno</Label>
              <Input {...register("firstName")} />
            </div>
            <div className="space-y-1.5">
              <Label>Příjmení</Label>
              <Input {...register("lastName")} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Klub</Label>
              <Input {...register("companyName")} />
            </div>
            <div className="space-y-1.5">
              <Label>Pozice</Label>
              <Input {...register("jobTitle")} />
            </div>
            <div className="space-y-1.5">
              <Label>Odhadovaná hodnota</Label>
              <Controller control={control} name="estimatedValue" render={({ field }) => <FormCurrencyInput value={field.value} onChange={field.onChange} />} />
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
              <Label>Zdroj</Label>
              <Controller control={control} name="source" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={LEAD_SOURCES.map((s) => ({ value: s, label: s }))} />} />
            </div>
            <div className="space-y-1.5">
              <Label>Kampaň</Label>
              <Input {...register("campaign")} />
            </div>
            <div className="space-y-1.5">
              <Label>Stav</Label>
              <Controller control={control} name="status" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={LEAD_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />} />
            </div>
            <div className="space-y-1.5">
              <Label>Hodnocení</Label>
              <Controller control={control} name="rating" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={LEAD_RATINGS.map((s) => ({ value: s.value, label: s.label }))} />} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Vlastník *</Label>
              <Controller control={control} name="ownerId" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={owners.map((o) => ({ value: o.id, label: o.name }))} />} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Poznámka</Label>
              <Textarea rows={3} {...register("notes")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : isEdit ? "Uložit změny" : "Vytvořit lead"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const LeadEditTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>((props, ref) => (
  <Button variant="ghost" size="icon-sm" ref={ref} {...props}><Pencil className="h-3.5 w-3.5" /></Button>
));
LeadEditTrigger.displayName = "LeadEditTrigger";

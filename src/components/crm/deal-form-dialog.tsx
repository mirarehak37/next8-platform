"use client";

import * as React from "react";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { LEAD_SOURCES } from "@/lib/constants";

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
}: {
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
    register, handleSubmit, control, formState: { errors, isSubmitting }, reset,
  } = useForm<DealInput>({
    resolver: zodResolver(dealSchema),
    defaultValues: deal ?? {
      name: "", ownerId: owners[0]?.id ?? "", pipelineId, stageId: defaultStageId ?? stages[0]?.id ?? "", value: 0,
    },
  });

  async function onSubmit(data: DealInput) {
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
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
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
              <Controller control={control} name="companyId" render={({ field }) => <FormCombobox value={field.value} onChange={field.onChange} options={companies.map((c) => ({ value: c.id, label: c.name }))} placeholder="Bez klubu" allowClear clearLabel="Bez klubu" />} />
            </div>
            <div className="space-y-1.5">
              <Label>Hodnota *</Label>
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

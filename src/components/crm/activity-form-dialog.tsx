"use client";

import type * as React from "react";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { activitySchema, type ActivityInput } from "@/lib/validations/crm";
import { createActivity } from "@/lib/actions/activities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { FormCombobox } from "@/components/form-combobox";
import { Plus } from "lucide-react";
import { ACTIVITY_TYPES } from "@/lib/constants";

type Option = { id: string; name: string };

export function ActivityFormDialog({
  companies,
  deals,
  defaultSubjectType,
  defaultSubjectId,
  trigger,
}: {
  companies: Option[];
  deals: Option[];
  defaultSubjectType?: string;
  defaultSubjectId?: string;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const {
    register, handleSubmit, control, watch, formState: { errors, isSubmitting }, reset,
  } = useForm<ActivityInput>({
    resolver: zodResolver(activitySchema),
    defaultValues: { type: "call", subject: "", subjectType: defaultSubjectType, subjectId: defaultSubjectId },
  });

  const subjectType = watch("subjectType");

  async function onSubmit(data: ActivityInput) {
    try {
      await createActivity(data);
      toast.success("Aktivita byla zaznamenána.");
      reset();
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button size="sm"><Plus className="h-4 w-4" /> Nová aktivita</Button>} />
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nová aktivita</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Typ</Label>
              <Controller control={control} name="type" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={ACTIVITY_TYPES.map((t) => ({ value: t.value, label: t.label }))} />} />
            </div>
            <div className="space-y-1.5">
              <Label>Datum a čas</Label>
              <Input type="datetime-local" {...register("activityAt")} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Předmět *</Label>
              <Input {...register("subject")} />
              {errors.subject && <p className="text-xs text-destructive">{errors.subject.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Vztaženo k</Label>
              <Controller
                control={control}
                name="subjectType"
                render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={[{ value: "company", label: "Klub" }, { value: "deal", label: "Obchodní případ" }]} placeholder="Bez vazby" />}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Záznam</Label>
              <Controller
                control={control}
                name="subjectId"
                render={({ field }) => (
                  <FormCombobox
                    value={field.value}
                    onChange={field.onChange}
                    options={(subjectType === "deal" ? deals : companies).map((o) => ({ value: o.id, label: o.name }))}
                    placeholder="Vyberte…"
                  />
                )}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Popis</Label>
              <Textarea rows={3} {...register("description")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : "Zaznamenat aktivitu"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

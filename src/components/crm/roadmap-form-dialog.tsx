"use client";

import * as React from "react";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { roadmapItemSchema, type RoadmapItemInput } from "@/lib/validations/crm";
import { createRoadmapItem, updateRoadmapItem } from "@/lib/actions/roadmap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { Plus, Pencil } from "lucide-react";
import { ROADMAP_STATUSES, ROADMAP_TYPES, ROADMAP_PRIORITIES, ROADMAP_EFFORTS, ROADMAP_QUARTERS } from "@/lib/constants";

type Option = { id: string; name: string };

export function RoadmapFormDialog({
  owners,
  modules,
  parentCandidates,
  item,
  defaultStatus,
  defaultParentId,
  trigger,
}: {
  owners: Option[];
  modules: Option[];
  parentCandidates: Option[];
  item?: (RoadmapItemInput & { id: string }) | null;
  defaultStatus?: string;
  defaultParentId?: string;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = !!item;

  const {
    register, handleSubmit, control, formState: { errors, isSubmitting }, reset,
  } = useForm<RoadmapItemInput>({
    resolver: zodResolver(roadmapItemSchema),
    defaultValues: item ?? {
      title: "", type: "idea", status: defaultStatus ?? "backlog", priority: "medium",
      ownerId: owners[0]?.id ?? "", parentId: defaultParentId ?? null,
    },
  });

  async function onSubmit(data: RoadmapItemInput) {
    try {
      if (isEdit) {
        await updateRoadmapItem(item!.id, data);
        toast.success("Položka byla upravena.");
      } else {
        await createRoadmapItem(data);
        toast.success("Položka byla přidána na roadmapu.");
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
      <DialogTrigger render={trigger ?? <Button size="sm"><Plus className="h-4 w-4" /> Nový nápad</Button>} />
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Upravit položku roadmapy" : "Nová položka roadmapy"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Název *</Label>
              <Input {...register("title")} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Popis</Label>
              <Textarea rows={3} {...register("description")} />
            </div>
            <div className="space-y-1.5">
              <Label>Typ</Label>
              <Controller control={control} name="type" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={ROADMAP_TYPES.map((t) => ({ value: t.value, label: t.label }))} />} />
            </div>
            <div className="space-y-1.5">
              <Label>Stav</Label>
              <Controller control={control} name="status" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={ROADMAP_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />} />
            </div>
            <div className="space-y-1.5">
              <Label>Priorita</Label>
              <Controller control={control} name="priority" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={ROADMAP_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} />} />
            </div>
            <div className="space-y-1.5">
              <Label>Náročnost</Label>
              <Controller control={control} name="effort" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={ROADMAP_EFFORTS.map((e) => ({ value: e.value, label: e.label }))} placeholder="Neurčeno" />} />
            </div>
            <div className="space-y-1.5">
              <Label>Cílové čtvrtletí</Label>
              <Controller control={control} name="targetQuarter" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={ROADMAP_QUARTERS.map((q) => ({ value: q, label: q }))} placeholder="Neurčeno" />} />
            </div>
            <div className="space-y-1.5">
              <Label>Modul platformy</Label>
              <Controller control={control} name="moduleId" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={modules.map((m) => ({ value: m.id, label: m.name }))} placeholder="Bez vazby" />} />
            </div>
            <div className="space-y-1.5">
              <Label>Nadřazená položka</Label>
              <Controller control={control} name="parentId" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={parentCandidates.map((p) => ({ value: p.id, label: p.name }))} placeholder="Samostatná položka" />} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Vlastník *</Label>
              <Controller control={control} name="ownerId" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={owners.map((o) => ({ value: o.id, label: o.name }))} />} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : isEdit ? "Uložit změny" : "Přidat na roadmapu"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const RoadmapEditTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>((props, ref) => (
  <Button variant="ghost" size="icon-sm" ref={ref} {...props}><Pencil className="h-3.5 w-3.5" /></Button>
));
RoadmapEditTrigger.displayName = "RoadmapEditTrigger";

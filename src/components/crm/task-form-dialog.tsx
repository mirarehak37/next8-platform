"use client";

import * as React from "react";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { taskSchema, type TaskInput } from "@/lib/validations/crm";
import { createTask, updateTask } from "@/lib/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { Plus, Pencil } from "lucide-react";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";

type Option = { id: string; name: string };

export function TaskFormDialog({
  assignees,
  task,
  trigger,
  defaultSubjectType,
  defaultSubjectId,
  defaultAssigneeId,
}: {
  assignees: Option[];
  task?: (TaskInput & { id: string }) | null;
  trigger?: React.ReactElement;
  // Created from a club / deal detail → the task stays linked to it.
  defaultSubjectType?: string;
  defaultSubjectId?: string;
  defaultAssigneeId?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = !!task;

  const {
    register, handleSubmit, control, formState: { errors, isSubmitting }, reset,
  } = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: task ?? {
      title: "", assigneeId: defaultAssigneeId ?? assignees[0]?.id ?? "", priority: "medium", status: "open",
      subjectType: defaultSubjectType, subjectId: defaultSubjectId,
    },
  });

  async function onSubmit(data: TaskInput) {
    try {
      if (isEdit) {
        await updateTask(task!.id, data);
        toast.success("Úkol byl upraven.");
      } else {
        await createTask(data);
        toast.success("Úkol byl vytvořen.");
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
      <DialogTrigger render={trigger ?? <Button size="sm"><Plus className="h-4 w-4" /> Nový úkol</Button>} />
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Upravit úkol" : "Nový úkol"}</DialogTitle>
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
              <Textarea rows={2} {...register("description")} />
            </div>
            <div className="space-y-1.5">
              <Label>Řešitel *</Label>
              <Controller control={control} name="assigneeId" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={assignees.map((a) => ({ value: a.id, label: a.name }))} />} />
            </div>
            <div className="space-y-1.5">
              <Label>Termín</Label>
              <Input type="date" {...register("dueDate")} />
            </div>
            <div className="space-y-1.5">
              <Label>Priorita</Label>
              <Controller control={control} name="priority" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={TASK_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} />} />
            </div>
            <div className="space-y-1.5">
              <Label>Stav</Label>
              <Controller control={control} name="status" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={TASK_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : isEdit ? "Uložit změny" : "Vytvořit úkol"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const TaskEditTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>((props, ref) => (
  <Button variant="ghost" size="icon-sm" ref={ref} {...props}><Pencil className="h-3.5 w-3.5" /></Button>
));
TaskEditTrigger.displayName = "TaskEditTrigger";

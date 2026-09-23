"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCustomField, deleteCustomField } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { Plus, Trash2 } from "lucide-react";

type FormValues = { entityType: string; key: string; label: string; fieldType: string; options?: string };

const ENTITY_OPTIONS = [
  { value: "company", label: "Klub" },
  { value: "contact", label: "Kontakt" },
  { value: "lead", label: "Lead" },
  { value: "deal", label: "Obchodní případ" },
];
const FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "number", label: "Číslo" },
  { value: "date", label: "Datum" },
  { value: "boolean", label: "Ano/Ne" },
  { value: "select", label: "Výběr (jedna hodnota)" },
  { value: "multiselect", label: "Výběr (více hodnot)" },
  { value: "currency", label: "Měna" },
];

export function CustomFieldDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({
    defaultValues: { entityType: "company", fieldType: "text" },
  });
  const fieldType = watch("fieldType");

  async function onSubmit(data: FormValues) {
    try {
      const options = data.options ? JSON.stringify(data.options.split(",").map((s) => s.trim()).filter(Boolean)) : undefined;
      await createCustomField({ ...data, options });
      toast.success("Vlastní pole bylo vytvořeno.");
      reset();
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><Plus className="h-4 w-4" /> Nové pole</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Nové vlastní pole</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Entita</Label>
            <Controller control={control} name="entityType" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={ENTITY_OPTIONS} />} />
          </div>
          <div className="space-y-1.5">
            <Label>Popisek (zobrazený název) *</Label>
            <Input {...register("label", { required: true })} />
          </div>
          <div className="space-y-1.5">
            <Label>Klíč (systémový, bez diakritiky) *</Label>
            <Input {...register("key", { required: true })} placeholder="napr_partner_level" />
            {errors.key && <p className="text-xs text-destructive">{errors.key.message ?? "Povinné pole"}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Typ pole</Label>
            <Controller control={control} name="fieldType" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={FIELD_TYPE_OPTIONS} />} />
          </div>
          {(fieldType === "select" || fieldType === "multiselect") && (
            <div className="space-y-1.5">
              <Label>Možnosti (oddělené čárkou)</Label>
              <Input {...register("options")} placeholder="Bronze, Silver, Gold" />
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : "Vytvořit pole"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteCustomFieldButton({ id }: { id: string }) {
  const router = useRouter();
  async function handleDelete() {
    try {
      await deleteCustomField(id);
      toast.success("Pole bylo smazáno.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }
  return (
    <Button variant="ghost" size="icon-sm" onClick={handleDelete}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

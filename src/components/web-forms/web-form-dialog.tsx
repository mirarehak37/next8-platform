"use client";

import * as React from "react";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { webFormSchema, type WebFormInput } from "@/lib/validations/web-forms";
import { createWebForm, deleteWebForm, updateWebForm } from "@/lib/actions/web-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { FormCombobox } from "@/components/form-combobox";
import { Section, Field } from "@/components/partnerships/form-parts";
import { Plus, Trash2 } from "lucide-react";

export function WebFormDialog({
  form,
  owners,
  campaigns,
  currentUserId,
  canDelete,
  trigger,
}: {
  form?: (WebFormInput & { id: string }) | null;
  owners: { id: string; name: string }[];
  campaigns: { value: string; label: string }[];
  currentUserId: string;
  canDelete?: boolean;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const blank = (): WebFormInput => ({ name: "", source: "Web – formulář", ownerId: currentUserId, isActive: true });
  const initial = () => (form ? { ...form } : blank());
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<WebFormInput>({
    resolver: zodResolver(webFormSchema),
    defaultValues: initial(),
  });

  async function onSubmit(values: WebFormInput) {
    try {
      if (form) await updateWebForm(form.id, values);
      else await createWebForm(values);
      toast.success(form ? "Formulář uložen." : "Formulář vytvořen.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  async function onDelete() {
    if (!confirm(`Smazat formulář „${form!.name}“? Leady z něj zůstanou.`)) return;
    await deleteWebForm(form!.id);
    toast.success("Formulář smazán.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) reset(initial()); }}>
      <DialogTrigger render={trigger ?? <Button size="sm"><Plus className="h-4 w-4" /> Nový formulář</Button>} />
      <DialogContent className="sm:max-w-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{form ? "Upravit formulář" : "Nový webový formulář"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Section title="Formulář">
            <Field label="Interní název *" error={errors.name?.message} className="sm:col-span-2">
              <Input placeholder="např. Web – demo pro trenéry" {...register("name")} />
            </Field>
            <Field label="Nadpis na stránce" className="sm:col-span-2">
              <Input placeholder="Vyzkoušej NEXT8 se svým týmem" {...register("headline")} />
            </Field>
            <Field label="Úvodní text" className="sm:col-span-2">
              <Textarea rows={2} placeholder="Nech nám kontakt, ozveme se do 24 hodin…" {...register("intro")} />
            </Field>
            <Field label="Poděkování po odeslání" className="sm:col-span-2">
              <Textarea rows={2} placeholder="Ozveme se ti do 24 hodin." {...register("thankYou")} />
            </Field>
          </Section>
          <Section title="Kam leady padají">
            <Field label="Přidělit obchodníkovi *" error={errors.ownerId?.message}>
              <Controller control={control} name="ownerId" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={owners.map((o) => ({ value: o.id, label: o.name }))} />
              )} />
            </Field>
            <Field label="Zdroj leadu">
              <Input {...register("source")} />
            </Field>
            <Field label="Výchozí kampaň" className="sm:col-span-2">
              <Controller control={control} name="campaign" render={({ field }) => (
                <FormCombobox value={field.value} onChange={field.onChange} options={campaigns} placeholder="Podle utm_campaign v odkazu" allowClear creatable />
              )} />
            </Field>
            <Field label="Aktivní">
              <Controller control={control} name="isActive" render={({ field }) => (
                <Switch checked={!!field.value} onCheckedChange={(v: boolean) => field.onChange(v)} />
              )} />
            </Field>
          </Section>
          <DialogFooter className="sm:justify-between gap-2">
            {form && canDelete ? <Button type="button" variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /> Smazat</Button> : <span />}
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : form ? "Uložit" : "Vytvořit"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

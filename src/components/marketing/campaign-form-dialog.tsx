"use client";

import * as React from "react";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { campaignSchema, type CampaignInput } from "@/lib/validations/marketing";
import { createCampaign, deleteCampaign, updateCampaign } from "@/lib/actions/marketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { FormCurrencyInput } from "@/components/form-currency-input";
import { Section, Field } from "@/components/partnerships/form-parts";
import { CAMPAIGN_STATUSES, MARKETING_AUDIENCES, MARKETING_CHANNELS } from "@/lib/constants";
import { slugify } from "@/lib/marketing";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

export type CampaignView = CampaignInput & { id: string };

export function CampaignFormDialog({
  campaign,
  owners,
  currentUserId,
  canDelete,
  trigger,
}: {
  campaign?: CampaignView | null;
  owners: { id: string; name: string }[];
  currentUserId?: string;
  canDelete?: boolean;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = !!campaign;
  const blank = (): CampaignInput => ({ name: "", status: "planned", channels: [], ownerId: currentUserId ?? owners[0]?.id ?? "" });
  const initial = (): CampaignInput => (campaign ? { ...campaign } : blank());

  const {
    register, handleSubmit, control, formState: { errors, isSubmitting }, reset, getValues, setValue,
  } = useForm<CampaignInput>({ resolver: zodResolver(campaignSchema), defaultValues: initial() });

  async function onSubmit(values: CampaignInput) {
    const data = { ...values, utmCampaign: values.utmCampaign?.trim() || slugify(values.name) };
    try {
      if (isEdit) {
        await updateCampaign(campaign!.id, data);
        toast.success("Kampaň byla uložena.");
        setOpen(false);
        router.refresh();
      } else {
        const c = await createCampaign(data);
        toast.success("Kampaň byla vytvořena.");
        reset(blank());
        setOpen(false);
        router.push(`/marketing/campaigns/${c.id}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  async function onDelete() {
    if (!confirm(`Smazat kampaň „${campaign!.name}“? Příspěvky zůstanou, jen bez kampaně.`)) return;
    try {
      await deleteCampaign(campaign!.id);
      toast.success("Kampaň byla smazána.");
      setOpen(false);
      router.push("/marketing/campaigns");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) reset(initial()); }}>
      <DialogTrigger render={trigger ?? <Button size="sm"><Plus className="h-4 w-4" /> Nová kampaň</Button>} />
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Upravit kampaň" : "Nová kampaň"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Section title="Kampaň">
            <Field label="Název *" error={errors.name?.message} className="sm:col-span-2">
              <Input
                placeholder="např. Start sezóny 2026/27 – trenéři"
                {...register("name", {
                  onBlur: () => { if (!getValues("utmCampaign")) setValue("utmCampaign", slugify(getValues("name"))); },
                })}
              />
            </Field>
            <Field label="Cíl" className="sm:col-span-2">
              <Input placeholder="např. 30 nových týmů na TEAM ONE do konce září" {...register("goal")} />
            </Field>
            <Field label="Publikum">
              <Controller control={control} name="audience" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={MARKETING_AUDIENCES.map((a) => ({ value: a.value, label: a.label }))} placeholder="Vyberte…" />
              )} />
            </Field>
            <Field label="Stav">
              <Controller control={control} name="status" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={CAMPAIGN_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
              )} />
            </Field>
            <Field label="Kanály" className="sm:col-span-2">
              <Controller control={control} name="channels" render={({ field }) => {
                const value = field.value ?? [];
                return (
                  <div className="flex flex-wrap gap-1.5">
                    {MARKETING_CHANNELS.map((c) => {
                      const on = value.includes(c.value);
                      return (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => field.onChange(on ? value.filter((v) => v !== c.value) : [...value, c.value])}
                          className={cn("rounded-full border px-2.5 py-1 text-xs", on ? "border-[#FF1947] bg-[#FF1947]/10 text-[#c4002a] dark:text-[#FF1947]" : "text-muted-foreground hover:bg-muted")}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                );
              }} />
            </Field>
            <Field label="Začátek"><Input type="date" {...register("startDate")} /></Field>
            <Field label="Konec"><Input type="date" {...register("endDate")} /></Field>
          </Section>

          <Section title="Rozpočet a měření">
            <Field label="Rozpočet">
              <Controller control={control} name="budget" render={({ field }) => (
                <FormCurrencyInput value={field.value as number | null | undefined} onChange={field.onChange} />
              )} />
            </Field>
            <Field label="Utraceno">
              <Controller control={control} name="spent" render={({ field }) => (
                <FormCurrencyInput value={field.value as number | null | undefined} onChange={field.onChange} />
              )} />
            </Field>
            <Field label="Cíl – počet leadů"><Input type="number" min={0} placeholder="např. 50" {...register("targetLeads")} /></Field>
            <Field label="utm_campaign">
              <Input placeholder="vyplní se z názvu" {...register("utmCampaign")} />
            </Field>
            <p className="sm:col-span-2 text-xs text-muted-foreground -mt-1">
              Leady, které mají v poli Kampaň tuto hodnotu nebo název kampaně, se kampani automaticky započítají.
            </p>
            <Field label="Vlastník *" error={errors.ownerId?.message}>
              <Controller control={control} name="ownerId" render={({ field }) => (
                <FormSelect value={field.value} onChange={field.onChange} options={owners.map((o) => ({ value: o.id, label: o.name }))} />
              )} />
            </Field>
            <Field label="Popis / brief" className="sm:col-span-2"><Textarea rows={3} {...register("description")} /></Field>
          </Section>

          <DialogFooter className="sm:justify-between gap-2">
            {isEdit && canDelete ? (
              <Button type="button" variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /> Smazat</Button>
            ) : <span />}
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : isEdit ? "Uložit" : "Vytvořit kampaň"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

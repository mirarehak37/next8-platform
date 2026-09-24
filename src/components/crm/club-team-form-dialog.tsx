"use client";

import * as React from "react";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClubTeam, updateClubTeam, type ClubTeamInput } from "@/lib/actions/club-teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormCombobox } from "@/components/form-combobox";
import { Plus, Pencil } from "lucide-react";
import { CLUB_TEAM_CATEGORIES } from "@/lib/constants";

export function ClubTeamFormDialog({
  companyId,
  team,
  trigger,
}: {
  companyId: string;
  team?: (ClubTeamInput & { id: string }) | null;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = !!team;

  const {
    register, handleSubmit, control, formState: { errors, isSubmitting }, reset,
  } = useForm<ClubTeamInput>({
    defaultValues: team ?? { companyId, category: "muži", name: "", league: "" },
  });

  async function onSubmit(data: ClubTeamInput) {
    try {
      if (isEdit) {
        await updateClubTeam(team!.id, data);
        toast.success("Tým byl upraven.");
      } else {
        await createClubTeam({ ...data, companyId });
        toast.success("Tým byl vytvořen.");
        reset({ companyId, category: "muži", name: "", league: "" });
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button size="sm"><Plus className="h-4 w-4" /> Nový tým</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Upravit tým" : "Nový tým"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Kategorie *</Label>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <FormCombobox value={field.value} onChange={field.onChange} options={CLUB_TEAM_CATEGORIES.map((c) => ({ value: c, label: c }))} placeholder="Vyberte kategorii" creatable />
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Název týmu *</Label>
            <Input {...register("name")} placeholder="Např. Zlín Lions B" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Soutěž / liga</Label>
            <Input {...register("league")} placeholder="Např. 1. liga mužů" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : isEdit ? "Uložit změny" : "Vytvořit tým"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const ClubTeamEditTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>((props, ref) => (
  <Button variant="ghost" size="icon-sm" ref={ref} {...props}><Pencil className="h-3.5 w-3.5" /></Button>
));
ClubTeamEditTrigger.displayName = "ClubTeamEditTrigger";

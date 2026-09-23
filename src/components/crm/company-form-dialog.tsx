"use client";

import * as React from "react";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { companySchema, type CompanyInput } from "@/lib/validations/crm";
import { createCompany, updateCompany } from "@/lib/actions/companies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { Plus, Pencil } from "lucide-react";
import { COMPANY_STATUSES, COMPANY_SIZE_BANDS, LEAD_SOURCES } from "@/lib/constants";

type Owner = { id: string; name: string };

export function CompanyFormDialog({
  owners,
  company,
  trigger,
}: {
  owners: Owner[];
  company?: (CompanyInput & { id: string }) | null;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = !!company;

  const {
    register, handleSubmit, control, formState: { errors, isSubmitting }, reset,
  } = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: company ?? { name: "", status: "prospect", ownerId: owners[0]?.id ?? "" },
  });

  async function onSubmit(data: CompanyInput) {
    try {
      if (isEdit) {
        await updateCompany(company!.id, data);
        toast.success("Firma byla upravena.");
      } else {
        await createCompany(data);
        toast.success("Firma byla vytvořena.");
        reset();
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  const ownerOptions = owners.map((o) => ({ value: o.id, label: o.name }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button size="sm">
              <Plus className="h-4 w-4" /> Nová firma
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Upravit firmu" : "Nová firma"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Název firmy *</Label>
              <Input {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>IČO</Label>
              <Input {...register("registrationNumber")} />
            </div>
            <div className="space-y-1.5">
              <Label>DIČ</Label>
              <Input {...register("vatNumber")} />
            </div>
            <div className="space-y-1.5">
              <Label>Stav</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <FormSelect value={field.value} onChange={field.onChange} options={COMPANY_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Velikost</Label>
              <Controller
                control={control}
                name="sizeBand"
                render={({ field }) => (
                  <FormSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={COMPANY_SIZE_BANDS.map((s) => ({ value: s, label: `${s} zaměstnanců` }))}
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Obor</Label>
              <Input {...register("industry")} />
            </div>
            <div className="space-y-1.5">
              <Label>Segment</Label>
              <Input {...register("segment")} placeholder="SMB / Mid-market / Enterprise" />
            </div>
            <div className="space-y-1.5">
              <Label>Web</Label>
              <Input {...register("website")} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input {...register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" {...register("email")} />
            </div>
            <div className="space-y-1.5">
              <Label>Zdroj</Label>
              <Controller
                control={control}
                name="source"
                render={({ field }) => (
                  <FormSelect value={field.value} onChange={field.onChange} options={LEAD_SOURCES.map((s) => ({ value: s, label: s }))} />
                )}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Adresa (sídlo)</Label>
              <Input {...register("billingStreet")} placeholder="Ulice a číslo" />
            </div>
            <div className="space-y-1.5">
              <Label>Město</Label>
              <Input {...register("billingCity")} />
            </div>
            <div className="space-y-1.5">
              <Label>PSČ</Label>
              <Input {...register("billingZip")} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Vlastník *</Label>
              <Controller
                control={control}
                name="ownerId"
                render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={ownerOptions} />}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Poznámka</Label>
              <Textarea rows={3} {...register("description")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Ukládám…" : isEdit ? "Uložit změny" : "Vytvořit firmu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const CompanyEditTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>((props, ref) => (
  <Button variant="outline" size="sm" ref={ref} {...props}>
    <Pencil className="h-3.5 w-3.5" /> Upravit
  </Button>
));
CompanyEditTrigger.displayName = "CompanyEditTrigger";

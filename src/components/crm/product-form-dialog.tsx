"use client";

import * as React from "react";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { productSchema, type ProductInput } from "@/lib/validations/crm";
import { createProduct, updateProduct } from "@/lib/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { FormCombobox } from "@/components/form-combobox";
import { FormCurrencyInput } from "@/components/form-currency-input";
import { Plus, Pencil } from "lucide-react";
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from "@/lib/constants";

export function ProductFormDialog({ product, trigger }: { product?: (ProductInput & { id: string }) | null; trigger?: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = !!product;

  const {
    register, handleSubmit, control, formState: { errors, isSubmitting }, reset,
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: product ?? { name: "", unit: "ks", price: 0, vatRate: 21, isRecurring: false, isActive: true },
  });

  async function onSubmit(data: ProductInput) {
    try {
      if (isEdit) {
        await updateProduct(product!.id, data);
        toast.success("Produkt byl upraven.");
      } else {
        await createProduct(data);
        toast.success("Produkt byl vytvořen.");
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
      <DialogTrigger render={trigger ?? <Button size="sm"><Plus className="h-4 w-4" /> Nový produkt</Button>} />
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Upravit produkt" : "Nový produkt / služba"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Název *</Label>
              <Input {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Kód</Label>
              <Input {...register("code")} />
            </div>
            <div className="space-y-1.5">
              <Label>Kategorie</Label>
              <Controller control={control} name="category" render={({ field }) => <FormCombobox value={field.value} onChange={field.onChange} options={PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c }))} placeholder="Vyberte kategorii" creatable allowClear />} />
            </div>
            <div className="space-y-1.5">
              <Label>Cena (bez DPH)</Label>
              <Controller control={control} name="price" render={({ field }) => <FormCurrencyInput value={field.value} onChange={field.onChange} />} />
            </div>
            <div className="space-y-1.5">
              <Label>DPH %</Label>
              <Input type="number" step="1" {...register("vatRate")} />
            </div>
            <div className="space-y-1.5">
              <Label>Jednotka</Label>
              <Controller control={control} name="unit" render={({ field }) => <FormCombobox value={field.value} onChange={field.onChange} options={[...PRODUCT_UNITS]} placeholder="Vyberte jednotku" creatable />} />
            </div>
            <div className="space-y-1.5">
              <Label>Fakturační perioda</Label>
              <Controller
                control={control}
                name="billingPeriod"
                render={({ field }) => (
                  <FormSelect value={field.value} onChange={field.onChange} options={[{ value: "monthly", label: "Měsíčně" }, { value: "yearly", label: "Ročně" }]} placeholder="Jednorázově" />
                )}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Popis</Label>
              <Textarea rows={2} {...register("description")} />
            </div>
            <div className="flex items-center gap-2">
              <Controller control={control} name="isRecurring" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
              <Label>Opakovaná platba</Label>
            </div>
            <div className="flex items-center gap-2">
              <Controller control={control} name="isActive" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
              <Label>Aktivní</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : isEdit ? "Uložit změny" : "Vytvořit produkt"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const ProductEditTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>((props, ref) => (
  <Button variant="ghost" size="icon-sm" ref={ref} {...props}>
    <Pencil className="h-3.5 w-3.5" />
  </Button>
));
ProductEditTrigger.displayName = "ProductEditTrigger";

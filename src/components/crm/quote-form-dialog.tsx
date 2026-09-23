"use client";

import { useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createQuote } from "@/lib/actions/quotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";

type Option = { id: string; name: string };
type ProductOption = { id: string; name: string; price: number; vatRate: number };

type FormValues = {
  dealId?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  validUntil?: string | null;
  terms?: string | null;
  notes?: string | null;
  items: { productId?: string | null; name: string; quantity: number; unitPrice: number; vatRate: number }[];
};

export function QuoteFormDialog({ companies, deals, products }: { companies: Option[]; deals: Option[]; products: ProductOption[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const { register, handleSubmit, control, watch, setValue, formState: { isSubmitting }, reset } = useForm<FormValues>({
    defaultValues: { items: [{ name: "", quantity: 1, unitPrice: 0, vatRate: 21 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = watch("items");

  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const vatTotal = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0) * ((Number(i.vatRate) || 0) / 100), 0);

  async function onSubmit(data: FormValues) {
    try {
      await createQuote(data);
      toast.success("Nabídka byla vytvořena.");
      reset({ items: [{ name: "", quantity: 1, unitPrice: 0, vatRate: 21 }] });
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  function applyProduct(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setValue(`items.${index}.productId`, productId);
    setValue(`items.${index}.name`, product.name);
    setValue(`items.${index}.unitPrice`, product.price);
    setValue(`items.${index}.vatRate`, product.vatRate);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><Plus className="h-4 w-4" /> Nová nabídka</Button>} />
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nová nabídka</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Firma</Label>
              <Controller control={control} name="companyId" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={companies.map((c) => ({ value: c.id, label: c.name }))} placeholder="Vyberte…" />} />
            </div>
            <div className="space-y-1.5">
              <Label>Obchodní případ</Label>
              <Controller control={control} name="dealId" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={deals.map((d) => ({ value: d.id, label: d.name }))} placeholder="Bez vazby" />} />
            </div>
            <div className="space-y-1.5">
              <Label>Platnost do</Label>
              <Input type="date" {...register("validUntil")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Položky</Label>
            <div className="border rounded-md divide-y">
              {fields.map((field, index) => (
                <div key={field.id} className="p-2.5 grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4 space-y-1">
                    {index === 0 && <Label className="text-xs">Produkt</Label>}
                    <FormSelect value={items[index]?.productId ?? undefined} onChange={(v) => applyProduct(index, v)} options={products.map((p) => ({ value: p.id, label: p.name }))} placeholder="Vyberte produkt" className="w-full" />
                  </div>
                  <div className="col-span-3 space-y-1">
                    {index === 0 && <Label className="text-xs">Název</Label>}
                    <Input {...register(`items.${index}.name` as const)} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && <Label className="text-xs">Množství</Label>}
                    <Input type="number" step="0.01" {...register(`items.${index}.quantity` as const)} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && <Label className="text-xs">Cena/ks</Label>}
                    <Input type="number" step="0.01" {...register(`items.${index}.unitPrice` as const)} />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(index)} disabled={fields.length === 1}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", quantity: 1, unitPrice: 0, vatRate: 21 })}>
              <Plus className="h-3.5 w-3.5" /> Přidat položku
            </Button>
          </div>

          <div className="flex justify-end text-sm space-y-1 flex-col items-end border-t pt-3">
            <div className="text-muted-foreground">Bez DPH: {formatCurrency(subtotal)}</div>
            <div className="text-muted-foreground">DPH: {formatCurrency(vatTotal)}</div>
            <div className="font-semibold text-base">Celkem: {formatCurrency(subtotal + vatTotal)}</div>
          </div>

          <div className="space-y-1.5">
            <Label>Obchodní podmínky</Label>
            <Textarea rows={2} {...register("terms")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : "Vytvořit nabídku"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

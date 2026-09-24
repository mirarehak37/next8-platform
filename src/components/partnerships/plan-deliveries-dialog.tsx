"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { planPartnershipDeliveries } from "@/lib/actions/partnership-terms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Section, Field } from "@/components/partnerships/form-parts";
import { CalendarPlus, Plus, X } from "lucide-react";

function addDays(date: string, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Schedules one or more delivery dates for an obligation (content calendar).
export function PlanDeliveriesDialog({ term }: { term: { id: string; title: string; quantity: number | null; period: string } }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const initialDates = () => {
    // Pre-fill as many dates as the term asks for, a week apart.
    const n = Math.min(Math.max(term.quantity ?? 1, 1), 8);
    return Array.from({ length: n }, (_, i) => addDays(today, 7 * (i + 1)));
  };
  const [dates, setDates] = useState<string[]>(initialDates);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const filled = dates.filter(Boolean);
    if (filled.length === 0) return toast.error("Zadejte aspoň jedno datum.");
    setSaving(true);
    try {
      await planPartnershipDeliveries({ termId: term.id, dates: filled, note });
      toast.success(filled.length === 1 ? "Naplánováno." : `Naplánováno ${filled.length}×.`);
      setOpen(false);
      setDates(initialDates());
      setNote("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="xs" variant="ghost"><CalendarPlus className="h-3 w-3" /> Naplánovat</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Naplánovat: {term.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <Section title="Termíny">
            <div className="sm:col-span-2 space-y-2">
              {dates.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input type="date" value={d} onChange={(e) => setDates(dates.map((x, j) => (j === i ? e.target.value : x)))} />
                  {dates.length > 1 && (
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setDates(dates.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5" /></Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setDates([...dates, addDays(dates[dates.length - 1] || today, 7)])}>
                <Plus className="h-3.5 w-3.5" /> Další termín
              </Button>
            </div>
            <Field label="Poznámka / brief" className="sm:col-span-2">
              <Textarea rows={2} placeholder="Téma, co ukázat, hashtagy…" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </Section>
          <DialogFooter>
            <Button onClick={save} disabled={saving}>{saving ? "Ukládám…" : "Naplánovat"}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

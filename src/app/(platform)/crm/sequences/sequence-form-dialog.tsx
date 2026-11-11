"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { createSequence } from "@/lib/actions/sequences";
import { SEQUENCE_STEP_TYPES } from "@/lib/sequences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";

type Step = { key: number; dayOffset: number; type: string; title: string; body: string };

const STARTER: Omit<Step, "key">[] = [
  { dayOffset: 0, type: "email", title: "Úvodní email", body: "" },
  { dayOffset: 3, type: "call", title: "Navazující hovor", body: "" },
  { dayOffset: 7, type: "email", title: "Připomenutí", body: "" },
];

export function SequenceFormDialog({ owners, currentUserId }: { owners: { id: string; name: string }[]; currentUserId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState(currentUserId);
  const [nextKey, setNextKey] = useState(STARTER.length);
  const [steps, setSteps] = useState<Step[]>(STARTER.map((s, key) => ({ ...s, key })));

  function update(key: number, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function addStep() {
    const last = steps[steps.length - 1];
    setSteps((prev) => [...prev, { key: nextKey, dayOffset: (last?.dayOffset ?? 0) + 3, type: "email", title: "", body: "" }]);
    setNextKey((k) => k + 1);
  }

  function reset() {
    setName("");
    setDescription("");
    setOwnerId(currentUserId);
    setSteps(STARTER.map((s, key) => ({ ...s, key })));
    setNextKey(STARTER.length);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        await createSequence({
          name,
          description,
          ownerId,
          steps: steps.map(({ dayOffset, type, title, body }) => ({ dayOffset, type, title, body })),
        });
        toast.success("Sekvence byla vytvořena.");
        reset();
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Sekvenci se nepodařilo uložit.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><Plus className="size-4" /> Nová sekvence</Button>} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nová sekvence</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="seq-name">Název *</Label>
              <Input id="seq-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Např. Oslovení nových klubů" required />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="seq-desc">Popis</Label>
              <Textarea id="seq-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Vlastník (dostane úkoly)</Label>
              <FormSelect value={ownerId} onChange={(v) => setOwnerId(v)} options={owners.map((o) => ({ value: o.id, label: o.name }))} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Kroky</Label>
              <span className="caption-style text-subtle">Den 0 = den zápisu kontaktu</span>
            </div>
            <ol className="space-y-2">
              {steps.map((step, index) => (
                <li key={step.key} className="space-y-2 rounded-lg bg-white/3 p-3 outline-1 -outline-offset-1 outline-white/6">
                  <div className="flex items-center gap-2">
                    <span className="caption-style w-5 shrink-0 text-subtle tabular-nums">{index + 1}.</span>
                    <div className="flex w-24 shrink-0 items-center gap-1.5">
                      <span className="caption-style text-subtle">Den</span>
                      <Input
                        type="number"
                        min={0}
                        max={365}
                        value={step.dayOffset}
                        onChange={(e) => update(step.key, { dayOffset: Math.max(0, Number(e.target.value) || 0) })}
                        aria-label={`Den kroku ${index + 1}`}
                      />
                    </div>
                    <div className="w-28 shrink-0">
                      <FormSelect
                        value={step.type}
                        onChange={(v) => update(step.key, { type: v })}
                        options={SEQUENCE_STEP_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                      />
                    </div>
                    <Input
                      value={step.title}
                      onChange={(e) => update(step.key, { title: e.target.value })}
                      placeholder="Název kroku"
                      aria-label={`Název kroku ${index + 1}`}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={steps.length === 1}
                      onClick={() => setSteps((prev) => prev.filter((s) => s.key !== step.key))}
                      aria-label={`Odebrat krok ${index + 1}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    rows={2}
                    value={step.body}
                    onChange={(e) => update(step.key, { body: e.target.value })}
                    placeholder={step.type === "email" ? "Text emailu / šablona (volitelné)" : "Poznámka pro úkol (volitelné)"}
                    aria-label={`Obsah kroku ${index + 1}`}
                  />
                </li>
              ))}
            </ol>
            {steps.length < 20 && (
              <Button type="button" variant="ghost" size="sm" onClick={addStep}>
                <Plus className="size-3.5" /> Přidat krok
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>{pending ? "Ukládám…" : "Vytvořit sekvenci"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { enrollContacts } from "@/lib/actions/sequences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type EnrollContact = { id: string; name: string; hint: string | null };

export function EnrollDialog({
  sequenceId,
  sequenceName,
  contacts,
  enrolledIds,
  disabled,
}: {
  sequenceId: string;
  sequenceName: string;
  contacts: EnrollContact[];
  enrolledIds: string[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const enrolled = useMemo(() => new Set(enrolledIds), [enrolledIds]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => !q || c.name.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q)).slice(0, 200);
  }, [contacts, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    startTransition(async () => {
      try {
        const result = await enrollContacts(sequenceId, Array.from(selected));
        toast.success(
          `Zapsáno ${result.enrolled} kontaktů${result.skipped ? `, ${result.skipped} už v sekvenci bylo` : ""}. Úkoly jsou v Úkolech.`,
        );
        setSelected(new Set());
        setQuery("");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Zápis se nezdařil.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="secondary" size="sm" disabled={disabled} title={disabled ? "Sekvence je pozastavená" : undefined}>
            <UserPlus className="size-3.5" /> Zapsat kontakty
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Zapsat do „{sequenceName}“</DialogTitle>
        </DialogHeader>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hledat kontakt nebo klub…" autoFocus />
        <ul className="-mx-1 max-h-72 overflow-y-auto">
          {visible.map((c) => {
            const isEnrolled = enrolled.has(c.id);
            return (
              <li key={c.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-white/4",
                    isEnrolled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <Checkbox
                    checked={isEnrolled || selected.has(c.id)}
                    disabled={isEnrolled}
                    onCheckedChange={() => toggle(c.id)}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                  <span className="caption-style max-w-[45%] truncate text-subtle">{isEnrolled ? "už zapsán" : c.hint}</span>
                </label>
              </li>
            );
          })}
          {visible.length === 0 && <li className="caption-style px-2 py-6 text-center text-subtle">Žádný kontakt neodpovídá.</li>}
        </ul>
        <DialogFooter>
          <span className="caption-style mr-auto self-center text-subtle">Vybráno {selected.size}</span>
          <Button onClick={submit} disabled={pending || selected.size === 0}>
            {pending ? "Zapisuji…" : "Zapsat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

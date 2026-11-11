"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pause, Play, Trash2 } from "lucide-react";
import { deleteSequence, setEnrollmentStatus, toggleSequence } from "@/lib/actions/sequences";
import { Button } from "@/components/ui/button";

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function run(task: () => Promise<unknown>, message: string) {
    startTransition(async () => {
      try {
        await task();
        toast.success(message);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Akce se nezdařila.");
      }
    });
  }
  return { pending, run };
}

export function SequenceToggle({ id, active }: { id: string; active: boolean }) {
  const { pending, run } = useAction();
  return (
    <Button
      variant={active ? "secondary" : "default"}
      size="sm"
      disabled={pending}
      aria-pressed={active}
      onClick={() => run(() => toggleSequence(id), active ? "Sekvence pozastavena." : "Sekvence obnovena.")}
    >
      {active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
      {active ? "Pozastavit" : "Obnovit"}
    </Button>
  );
}

export function SequenceDelete({ id, name }: { id: string; name: string }) {
  const { pending, run } = useAction();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label={`Smazat sekvenci ${name}`}
      onClick={() => {
        if (!confirm(`Smazat sekvenci „${name}“? Otevřené úkoly běžících kontaktů se zruší.`)) return;
        run(() => deleteSequence(id), "Sekvence smazána.");
      }}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}

export function EnrollmentActions({ id }: { id: string }) {
  const { pending, run } = useAction();
  return (
    <span className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="xs"
        disabled={pending}
        onClick={() => run(() => setEnrollmentStatus(id, "replied"), "Označeno jako odpověděl, zbylé úkoly zrušeny.")}
      >
        Odpověděl
      </Button>
      <Button
        variant="ghost"
        size="xs"
        disabled={pending}
        onClick={() => run(() => setEnrollmentStatus(id, "stopped"), "Kontakt vyřazen ze sekvence.")}
      >
        Zastavit
      </Button>
    </span>
  );
}

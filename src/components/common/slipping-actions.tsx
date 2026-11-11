"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createActivity } from "@/lib/actions/activities";
import { updateDeal } from "@/lib/actions/deals";
import { Button } from "@/components/ui/button";

export function SlippingActions({ dealId, canLog, canEdit }: { dealId: string; canLog: boolean; canEdit: boolean }) {
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

  return (
    <span className="flex justify-end gap-1.5">
      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            const next = new Date();
            next.setDate(next.getDate() + 14);
            run(() => updateDeal(dealId, { expectedCloseDate: next.toISOString().slice(0, 10) }), "Termín uzavření posunut o 14 dní.");
          }}
        >
          +14 dní
        </Button>
      )}
      {canLog && (
        <Button
          variant="secondary"
          size="sm"
          title="Zaznamenat kontakt jako aktivitu u obchodu"
          disabled={pending}
          onClick={() =>
            run(
              () => createActivity({ type: "note", subject: "Kontrola obchodu", subjectType: "deal", subjectId: dealId }),
              "Kontakt zaznamenán.",
            )
          }
        >
          Kontaktováno
        </Button>
      )}
    </span>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { convertLead } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowRightCircle } from "lucide-react";

export function ConvertLeadDialog({
  leadId,
  leadLabel,
  pipelineId,
  firstStageId,
}: {
  leadId: string;
  leadLabel: string;
  pipelineId: string;
  firstStageId: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, setPending] = useState(false);
  const router = useRouter();

  async function handleConvert() {
    setPending(true);
    try {
      await convertLead(leadId, pipelineId, firstStageId);
      toast.success("Lead byl převeden na firmu, kontakt a obchodní případ.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm"><ArrowRightCircle className="h-3.5 w-3.5" /> Převést</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Převést lead</DialogTitle>
          <DialogDescription>
            Z leadu <strong>{leadLabel}</strong> se vytvoří firma (pokud je uvedena), kontakt a nový obchodní případ v první fázi pipeline.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleConvert} disabled={isPending}>{isPending ? "Převádím…" : "Potvrdit převod"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

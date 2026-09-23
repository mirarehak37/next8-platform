"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setQuoteStatus } from "@/lib/actions/quotes";
import { FormSelect } from "@/components/form-select";
import { QUOTE_STATUSES } from "@/lib/constants";

export function QuoteStatusControl({ quoteId, status }: { quoteId: string; status: string }) {
  const router = useRouter();

  async function handleChange(value: string) {
    try {
      await setQuoteStatus(quoteId, value);
      toast.success("Stav nabídky byl změněn.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  return (
    <FormSelect
      value={status}
      onChange={handleChange}
      options={QUOTE_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
      className="w-[180px]"
    />
  );
}

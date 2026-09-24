"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteAmbassador } from "@/lib/actions/ambassadors";
import { deletePartner } from "@/lib/actions/partners";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

const TARGETS = {
  ambassador: { action: deleteAmbassador, redirect: "/crm/ambassadors", label: "ambasadora" },
  partner: { action: deletePartner, redirect: "/crm/partners", label: "partnera" },
};

export function DeleteRecordButton({ kind, id, name }: { kind: keyof typeof TARGETS; id: string; name: string }) {
  const router = useRouter();
  const target = TARGETS[kind];

  async function handleDelete() {
    if (!confirm(`Opravdu smazat ${target.label} „${name}“ včetně podmínek, evidence plnění a dokumentů?`)) return;
    try {
      await target.action(id);
      toast.success("Záznam byl smazán.");
      router.push(target.redirect);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDelete}>
      <Trash2 className="h-3.5 w-3.5" /> Smazat
    </Button>
  );
}

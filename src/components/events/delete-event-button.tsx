"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteEvent } from "@/lib/actions/events";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DeleteEventButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  async function handleDelete() {
    if (!confirm(`Opravdu smazat akci „${name}“ včetně všech přihlášek?`)) return;
    try {
      await deleteEvent(id);
      toast.success("Akce byla smazána.");
      router.push("/events");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5" /> Smazat</Button>
  );
}

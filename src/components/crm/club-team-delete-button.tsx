"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteClubTeam } from "@/lib/actions/club-teams";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function ClubTeamDeleteButton({ id }: { id: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Opravdu smazat tento tým?")) return;
    try {
      await deleteClubTeam(id);
      toast.success("Tým byl smazán.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  return (
    <Button variant="ghost" size="icon-sm" onClick={handleDelete}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createTeam, addTeamMember, removeTeamMember } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { Plus, X } from "lucide-react";

export function CreateTeamDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { register, handleSubmit, formState: { isSubmitting }, reset } = useForm<{ name: string; description?: string }>();

  async function onSubmit(data: { name: string; description?: string }) {
    try {
      await createTeam(data);
      toast.success("Tým byl vytvořen.");
      reset();
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><Plus className="h-4 w-4" /> Nový tým</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Nový tým</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Název *</Label>
            <Input {...register("name", { required: true })} />
          </div>
          <div className="space-y-1.5">
            <Label>Popis</Label>
            <Input {...register("description")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ukládám…" : "Vytvořit"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddTeamMemberControl({ teamId, candidates }: { teamId: string; candidates: { id: string; name: string }[] }) {
  const router = useRouter();
  async function handleAdd(userId: string) {
    try {
      await addTeamMember(teamId, userId);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }
  if (candidates.length === 0) return null;
  return <FormSelect value={undefined} onChange={handleAdd} options={candidates.map((c) => ({ value: c.id, label: c.name }))} placeholder="+ Přidat člena" className="w-[180px] h-8" />;
}

export function RemoveTeamMemberButton({ memberId }: { memberId: string }) {
  const router = useRouter();
  async function handleRemove() {
    try {
      await removeTeamMember(memberId);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }
  return (
    <button onClick={handleRemove} className="text-muted-foreground hover:text-destructive">
      <X className="h-3 w-3" />
    </button>
  );
}

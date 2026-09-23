"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createUser } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { UserPlus } from "lucide-react";

type FormValues = { name: string; email: string; jobTitle?: string; roleId: string };

export function InviteUserDialog({ roles }: { roles: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { register, handleSubmit, control, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({ defaultValues: { roleId: roles[0]?.id } });

  async function onSubmit(data: FormValues) {
    try {
      await createUser(data);
      toast.success("Uživatel byl pozván.");
      reset();
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><UserPlus className="h-4 w-4" /> Pozvat uživatele</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pozvat uživatele</DialogTitle>
          <DialogDescription>Vytvoří se účet s dočasným heslem a přiřazenou rolí.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Jméno *</Label>
            <Input {...register("name", { required: true })} />
            {errors.name && <p className="text-xs text-destructive">Povinné pole</p>}
          </div>
          <div className="space-y-1.5">
            <Label>E-mail *</Label>
            <Input type="email" {...register("email", { required: true })} />
            {errors.email && <p className="text-xs text-destructive">Povinné pole</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Pozice</Label>
            <Input {...register("jobTitle")} />
          </div>
          <div className="space-y-1.5">
            <Label>Role *</Label>
            <Controller control={control} name="roleId" render={({ field }) => <FormSelect value={field.value} onChange={field.onChange} options={roles.map((r) => ({ value: r.id, label: r.name }))} />} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Odesílám…" : "Pozvat"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

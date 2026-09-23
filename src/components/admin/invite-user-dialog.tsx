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
import { UserPlus, Copy, Check } from "lucide-react";

type FormValues = { name: string; email: string; jobTitle?: string; roleId: string };

export function InviteUserDialog({ roles }: { roles: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const { register, handleSubmit, control, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({ defaultValues: { roleId: roles[0]?.id } });

  async function onSubmit(data: FormValues) {
    try {
      const result = await createUser(data);
      setCreated({ email: data.email, tempPassword: result.tempPassword });
      reset();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setCreated(null);
      setCopied(false);
    }
  }

  async function handleCopy() {
    if (!created) return;
    await navigator.clipboard.writeText(created.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm"><UserPlus className="h-4 w-4" /> Pozvat uživatele</Button>} />
      <DialogContent className="sm:max-w-sm">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Uživatel byl pozván</DialogTitle>
              <DialogDescription>
                Předejte mu tyto přihlašovací údaje bezpečným kanálem — po přihlášení se zobrazí jen jednou.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">E-mail</Label>
                <div className="font-medium">{created.email}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Dočasné heslo</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 rounded-md border bg-muted px-2.5 py-1.5 font-mono text-sm">{created.tempPassword}</code>
                  <Button type="button" variant="outline" size="icon-sm" onClick={handleCopy}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Hotovo</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Pozvat uživatele</DialogTitle>
              <DialogDescription>Vytvoří se účet s náhodně vygenerovaným dočasným heslem a přiřazenou rolí.</DialogDescription>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

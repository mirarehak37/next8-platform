"use client";

import { useState, useTransition } from "react";
import { setupWorkspace } from "@/lib/actions/setup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SetupForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    const password = formData.get("password");
    const passwordConfirm = formData.get("passwordConfirm");
    if (password !== passwordConfirm) {
      setError("Hesla se neshodují.");
      return;
    }
    startTransition(async () => {
      const result = await setupWorkspace(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Vaše jméno</Label>
        <Input id="name" name="name" required autoComplete="name" placeholder="Jan Novák" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" placeholder="jan@next8.cz" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Heslo</Label>
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="passwordConfirm">Heslo znovu</Label>
        <Input id="passwordConfirm" name="passwordConfirm" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Zakládám pracovní prostor…" : "Založit pracovní prostor NEXT8"}
      </Button>
    </form>
  );
}

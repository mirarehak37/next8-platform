"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { registerTenant } from "@/lib/actions/register";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Target, CheckSquare, BarChart3 } from "lucide-react";

export default function RegisterPage() {
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
      const result = await registerTenant(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="min-h-screen w-full flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-neutral-950 text-white flex-col justify-between p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FF1947]/20 via-neutral-950 to-neutral-950" />
        <div className="relative">
          <Image src="/brand/logo-white.png" alt="NEXT8" width={140} height={34} className="h-8 w-auto" priority />
        </div>
        <div className="relative space-y-8 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">
            Založte si vlastní pracovní prostor za méně než minutu.
          </h1>
          <p className="text-neutral-400">
            Vytvoříme vám samostatnou firemní organizaci — s vlastními uživateli, oprávněními
            a obchodní pipeline — připravenou hned začít evidovat firmy, kontakty a obchody.
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm text-neutral-300">
            <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-[#FF1947]" /> Vlastní firemní data</div>
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-[#FF1947]" /> Role a oprávnění</div>
            <div className="flex items-center gap-2"><Target className="h-4 w-4 text-[#FF1947]" /> Kanban pipeline</div>
            <div className="flex items-center gap-2"><CheckSquare className="h-4 w-4 text-[#FF1947]" /> Úkoly a aktivity</div>
            <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[#FF1947]" /> Reporty a forecast</div>
          </div>
        </div>
        <div className="relative text-xs text-neutral-500">© 2026 NEXT8 Performance</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-muted/30">
        <div className="w-full max-w-md">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Registrace firmy</CardTitle>
              <CardDescription>Vytvořte si vlastní pracovní prostor a začněte evidovat reálná data.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Název firmy</Label>
                  <Input id="companyName" name="companyName" required autoComplete="organization" placeholder="Moje firma s.r.o." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Vaše jméno</Label>
                  <Input id="name" name="name" required autoComplete="name" placeholder="Jan Novák" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" name="email" type="email" required autoComplete="email" placeholder="jan@mojefirma.cz" />
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
                  {isPending ? "Zakládám organizaci…" : "Vytvořit pracovní prostor"}
                </Button>
              </form>
              <p className="text-sm text-muted-foreground text-center mt-4">
                Už máte účet?{" "}
                <Link href="/login" className="text-foreground font-medium hover:underline">
                  Přihlaste se
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

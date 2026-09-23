"use client";

import { useState, useTransition, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Target, CheckSquare, BarChart3 } from "lucide-react";

const DEMO_ACCOUNTS = [
  { email: "admin@next8.cz", role: "Administrator", name: "Adam Novák" },
  { email: "reditel@next8.cz", role: "Management", name: "Petra Svobodová" },
  { email: "vedouci.obchodu@next8.cz", role: "Sales Manager", name: "Tomáš Dvořák" },
  { email: "lucie.prochazkova@next8.cz", role: "Sales", name: "Lucie Procházková" },
  { email: "marketing@next8.cz", role: "Marketing", name: "Eva Marková" },
  { email: "finance@next8.cz", role: "Finance", name: "Martin Král" },
  { email: "podpora@next8.cz", role: "Support", name: "Kateřina Veselá" },
  { email: "viewer@next8.cz", role: "Read Only", name: "Viktor Čtenář" },
];

function LoginForm() {
  const [email, setEmail] = useState("admin@next8.cz");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await loginAction(formData);
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
            Modulární business platforma pro digitalizaci vaší firmy.
          </h1>
          <p className="text-neutral-400">
            CRM je první modul. Firmy, kontakty, obchodní případy, nabídky a úkoly na jednom místě —
            připraveno na Faktury, Projekty, HelpDesk a další agendy.
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm text-neutral-300">
            <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-[#FF1947]" /> 360° pohled na firmy</div>
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-[#FF1947]" /> Kontakty a role</div>
            <div className="flex items-center gap-2"><Target className="h-4 w-4 text-[#FF1947]" /> Kanban pipeline</div>
            <div className="flex items-center gap-2"><CheckSquare className="h-4 w-4 text-[#FF1947]" /> Úkoly a aktivity</div>
            <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[#FF1947]" /> Reporty a forecast</div>
          </div>
        </div>
        <div className="relative text-xs text-neutral-500">© 2026 NEXT8 Performance — interní demo prostředí</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-muted/30">
        <div className="w-full max-w-md space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Přihlášení</CardTitle>
              <CardDescription>Přihlaste se do své business platformy.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={handleSubmit} className="space-y-4">
                <input type="hidden" name="callbackUrl" value={callbackUrl} />
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Heslo</Label>
                  <Input id="password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? "Přihlašuji…" : "Přihlásit se"}
                </Button>
              </form>
              <p className="text-sm text-muted-foreground text-center mt-4">
                Nemáte účet?{" "}
                <Link href="/register" className="text-foreground font-medium hover:underline">
                  Zaregistrujte svou firmu
                </Link>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Rychlé demo přihlášení</CardTitle>
              <CardDescription>Klikněte na roli a vyzkoušejte odlišná oprávnění napříč platformou. Heslo pro všechny: demo1234</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => setEmail(account.email)}
                  className={`text-left rounded-md border px-3 py-2 text-xs transition-colors hover:bg-accent ${
                    email === account.email ? "border-primary bg-accent" : "border-border"
                  }`}
                >
                  <div className="font-medium">{account.role}</div>
                  <div className="text-muted-foreground">{account.name}</div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

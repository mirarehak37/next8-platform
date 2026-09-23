import Image from "next/image";
import Link from "next/link";
import { isSetupComplete } from "@/lib/actions/setup";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SetupForm } from "./setup-form";
import { Building2, Users, Target, CheckSquare, BarChart3, CheckCircle2 } from "lucide-react";

// Must be evaluated per-request against the live DB — a static build-time render
// would bake in whatever isSetupComplete() returned during `next build`, which is
// wrong once this deploys against production's (initially empty) database.
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const alreadySetUp = await isSetupComplete();

  return (
    <div className="min-h-screen w-full flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-neutral-950 text-white flex-col justify-between p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FF1947]/20 via-neutral-950 to-neutral-950" />
        <div className="relative">
          <Image src="/brand/logo-white.png" alt="NEXT8" width={140} height={34} className="h-8 w-auto" priority />
        </div>
        <div className="relative space-y-8 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">
            Interní business platforma NEXT8.
          </h1>
          <p className="text-neutral-400">
            Tento pracovní prostor patří výhradně firmě NEXT8 — není to veřejná SaaS
            platforma pro libovolné firmy. Další kolegy přidává administrátor přímo
            v aplikaci (Administrace → Uživatelé).
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
            {alreadySetUp ? (
              <>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" /> Už je to hotové
                  </CardTitle>
                  <CardDescription>
                    Pracovní prostor NEXT8 je už nastavený. Tohle jednorázové založení jde spustit jen jednou —
                    noví kolegové se přidávají přes Administrace → Uživatelé.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/login" className={cn(buttonVariants({ variant: "default" }), "w-full")}>
                    Přejít na přihlášení
                  </Link>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader>
                  <CardTitle className="text-2xl">Nastavení NEXT8</CardTitle>
                  <CardDescription>
                    Založíte první (administrátorský) účet pro firemní pracovní prostor NEXT8. Tento krok jde
                    provést jen jednou.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SetupForm />
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

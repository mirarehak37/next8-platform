"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { importFlorbalClubs } from "@/lib/actions/admin-florbal-import";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function FlorbalImportButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ clubsCreated: number; teamsCreated: number; clubsSkipped: number } | null>(null);

  function handleImport() {
    startTransition(async () => {
      try {
        const res = await importFlorbalClubs();
        setResult(res);
        if (res.clubsCreated > 0) {
          toast.success(`Naimportováno ${res.clubsCreated} klubů a ${res.teamsCreated} týmů.`);
        } else {
          toast.info("Všechny kluby už v databázi jsou — nic k importu.");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Vytvoří klub (Company, sport = Florbal) pro každý klub registrovaný v adresáři Českého florbalu, který
          v databázi ještě není, a k němu všechny jeho týmy (kategorie + soutěž). Vlastníkem nově vytvořených
          záznamů bude aktuálně přihlášený účet. Bezpečné spustit i opakovaně — kluby, co už existují, se přeskočí.
        </p>
        <Button onClick={handleImport} disabled={isPending}>
          {isPending ? "Importuji…" : "Spustit import"}
        </Button>
        {result && (
          <div className="text-sm rounded-md border p-3 space-y-1">
            <div>Vytvořeno klubů: <strong>{result.clubsCreated}</strong></div>
            <div>Vytvořeno týmů: <strong>{result.teamsCreated}</strong></div>
            <div>Přeskočeno (už existovaly): <strong>{result.clubsSkipped}</strong></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

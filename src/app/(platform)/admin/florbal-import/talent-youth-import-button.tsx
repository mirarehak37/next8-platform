"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { importTalentYouth } from "@/lib/actions/admin-talent-youth-import";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function TalentYouthImportButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ alreadyExists: boolean; teamsCreated: number; contactsCreated: number } | null>(null);

  function handleImport() {
    startTransition(async () => {
      try {
        const res = await importTalentYouth();
        setResult(res);
        if (res.alreadyExists) {
          toast.info("Výběry talentované mládeže už v databázi jsou.");
        } else {
          toast.success(`Založeno ${res.teamsCreated} výběrů a ${res.contactsCreated} kontaktů (trenéři).`);
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
          Založí „Výběry talentované mládeže" (BU14–BU17, GU15–GU17, západ/východ) jako samostatnou organizaci — ne
          klub — s 12 výběry a jejich hlavními trenéry jako kontakty. Bezpečné spustit i opakovaně.
        </p>
        <Button onClick={handleImport} disabled={isPending}>
          {isPending ? "Zakládám…" : "Založit výběry talentované mládeže"}
        </Button>
        {result && !result.alreadyExists && (
          <div className="text-sm rounded-md border p-3 space-y-1">
            <div>Vytvořeno výběrů: <strong>{result.teamsCreated}</strong></div>
            <div>Vytvořeno kontaktů: <strong>{result.contactsCreated}</strong></div>
          </div>
        )}
        {result?.alreadyExists && <p className="text-sm text-muted-foreground">Už existuje — nic nového se nezaložilo.</p>}
      </CardContent>
    </Card>
  );
}

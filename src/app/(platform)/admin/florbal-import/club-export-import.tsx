"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { parseClubExport, type ClubExport } from "@/lib/club-export";
import { finishClubExportImport, importClubExportBatch, type ClubExportResult } from "@/lib/actions/admin-club-export-import";
import { Upload } from "lucide-react";

const BATCH = 20; // clubs per request — keeps each call well inside Vercel's time limit

const EMPTY: ClubExportResult = { clubsUpdated: 0, clubsCreated: 0, contactsCreated: 0, contactsMatched: 0, clubLinks: 0, teamLinks: 0, teamsCreated: 0 };

export function ClubExportImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [clubs, setClubs] = useState<ClubExport[] | null>(null);
  const [fileInfo, setFileInfo] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<ClubExportResult | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setResult(null);
    try {
      const { clubs: parsed, rows } = parseClubExport(await file.text());
      setClubs(parsed);
      const people = new Set(parsed.flatMap((c) => [c.secretary, c.chairman, ...c.teams.map((t) => t.contact)]).filter(Boolean).map((p) => (p!.email || p!.name).toLowerCase()));
      setFileInfo(`${file.name}: ${rows} řádků · ${parsed.length} klubů · ${parsed.reduce((s, c) => s + c.teams.length, 0)} družstev · ~${people.size} lidí`);
    } catch (e) {
      setClubs(null);
      setFileInfo(null);
      toast.error(e instanceof Error ? e.message : "Soubor se nepodařilo načíst.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function run() {
    if (!clubs) return;
    const totals = { ...EMPTY };
    setProgress(0);
    try {
      for (let i = 0; i < clubs.length; i += BATCH) {
        const r = await importClubExportBatch(clubs.slice(i, i + BATCH));
        (Object.keys(totals) as (keyof ClubExportResult)[]).forEach((k) => (totals[k] += r[k]));
        setProgress(Math.min(i + BATCH, clubs.length));
      }
      await finishClubExportImport(totals);
      setResult(totals);
      toast.success("Import dokončen.");
    } catch (e) {
      toast.error(`Import se zastavil: ${e instanceof Error ? e.message : "chyba"}. Lze ho bezpečně spustit znovu.`);
      setResult(totals);
    } finally {
      setProgress(null);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <div className="font-semibold">Kontakty a adresy klubů z exportu (CSV)</div>
          <p className="text-sm text-muted-foreground mt-1">
            Soubor „kluby + družstva + kontakty“ (oddělovač středník). Klubům doplní adresu a počet členů (jen prázdná pole),
            založí sekretáře, předsedu a kontaktní osoby družstev a propojí je s klubem a konkrétním týmem. Lidé se párují podle
            e-mailu, takže se nezdvojí. Bezpečné spustit i opakovaně. Soubor se nikam neukládá.
          </p>
        </div>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={progress !== null}>
            <Upload className="h-4 w-4" /> Vybrat CSV
          </Button>
          <Button onClick={run} disabled={!clubs || progress !== null}>
            {progress !== null ? `Importuji… ${progress} / ${clubs?.length}` : "Spustit import"}
          </Button>
        </div>
        {fileInfo && <p className="text-sm">{fileInfo}</p>}
        {progress !== null && clubs && (
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-[#FF1947] transition-all" style={{ width: `${Math.round((progress / clubs.length) * 100)}%` }} />
          </div>
        )}
        {result && (
          <div className="text-sm rounded-md border p-3 grid grid-cols-2 gap-1">
            <div>Kluby doplněné: <strong>{result.clubsUpdated}</strong></div>
            <div>Kluby nové: <strong>{result.clubsCreated}</strong></div>
            <div>Nové kontakty: <strong>{result.contactsCreated}</strong></div>
            <div>Už existující kontakty: <strong>{result.contactsMatched}</strong></div>
            <div>Vazby kontakt ↔ klub: <strong>{result.clubLinks}</strong></div>
            <div>Vazby kontakt ↔ tým: <strong>{result.teamLinks}</strong></div>
            <div>Nově založené týmy: <strong>{result.teamsCreated}</strong></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

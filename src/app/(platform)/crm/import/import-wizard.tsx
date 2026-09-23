"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { FormSelect } from "@/components/form-select";
import { IMPORT_ENTITIES, IMPORT_FIELDS, type ImportEntity } from "@/lib/import-config";
import { parseImportFile, parseImportText, type ParsedTable } from "@/lib/import-parser";
import { bulkImport, type ImportResult } from "@/lib/actions/import";
import { Upload, FileSpreadsheet, ClipboardPaste, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

type Step = "source" | "mapping" | "result";

function guessMapping(headers: string[], entity: ImportEntity): Record<number, string> {
  const fields = IMPORT_FIELDS[entity];
  const mapping: Record<number, string> = {};
  headers.forEach((header, i) => {
    const norm = header.toLowerCase().trim();
    const match = fields.find(
      (f) => f.key.toLowerCase() === norm || f.label.toLowerCase() === norm || norm.includes(f.label.toLowerCase()) || f.label.toLowerCase().includes(norm),
    );
    if (match) mapping[i] = match.key;
  });
  return mapping;
}

export function ImportWizard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("source");
  const [entity, setEntity] = useState<ImportEntity>("company");
  const [pastedText, setPastedText] = useState("");
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const fields = IMPORT_FIELDS[entity];

  async function handleFile(file: File) {
    setIsParsing(true);
    try {
      const parsed = await parseImportFile(file);
      if (parsed.headers.length === 0) {
        toast.error("Soubor neobsahuje žádná data.");
        return;
      }
      setTable(parsed);
      setMapping(guessMapping(parsed.headers, entity));
      setStep("mapping");
    } catch {
      toast.error("Soubor se nepodařilo přečíst. Zkontrolujte formát (.xlsx, .xls, .csv).");
    } finally {
      setIsParsing(false);
    }
  }

  function handleParseText() {
    const parsed = parseImportText(pastedText);
    if (parsed.headers.length === 0) {
      toast.error("Vložte data ve formátu CSV (první řádek = názvy sloupců).");
      return;
    }
    setTable(parsed);
    setMapping(guessMapping(parsed.headers, entity));
    setStep("mapping");
  }

  const mappedRows = useMemo(() => {
    if (!table) return [];
    const usedFields = new Set(Object.values(mapping));
    return table.rows.map((row) => {
      const obj: Record<string, string> = {};
      for (const [colIndex, fieldKey] of Object.entries(mapping)) {
        if (fieldKey) obj[fieldKey] = row[Number(colIndex)] ?? "";
      }
      return { obj, hasRequired: fields.filter((f) => f.required).every((f) => usedFields.has(f.key) && obj[f.key]?.trim()) };
    });
  }, [table, mapping, fields]);

  const requiredMapped = fields.filter((f) => f.required).every((f) => Object.values(mapping).includes(f.key));
  const validRowCount = mappedRows.filter((r) => r.hasRequired).length;

  async function handleImport() {
    setIsImporting(true);
    try {
      const res = await bulkImport(entity, mappedRows.map((r) => r.obj));
      setResult(res);
      setStep("result");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import se nezdařil.");
    } finally {
      setIsImporting(false);
    }
  }

  function reset() {
    setStep("source");
    setTable(null);
    setMapping({});
    setPastedText("");
    setResult(null);
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={step === "source" ? "font-medium text-foreground" : ""}>1. Zdroj dat</span>
        <span>→</span>
        <span className={step === "mapping" ? "font-medium text-foreground" : ""}>2. Mapování a náhled</span>
        <span>→</span>
        <span className={step === "result" ? "font-medium text-foreground" : ""}>3. Výsledek</span>
      </div>

      {step === "source" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Co chcete importovat?</CardTitle>
            <CardDescription>Vyberte typ záznamů a poté nahrajte soubor (.xlsx, .csv) nebo vložte data jako text.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {IMPORT_ENTITIES.map((e) => (
                <button
                  key={e.value}
                  onClick={() => setEntity(e.value)}
                  className={`text-left rounded-md border px-3 py-2.5 text-sm transition-colors ${entity === e.value ? "border-[#FF1947] bg-[#FF1947]/5" : "hover:bg-muted"}`}
                >
                  <div className="font-medium">{e.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{e.description}</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-md p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium"><FileSpreadsheet className="h-4 w-4" /> Nahrát soubor</div>
                <p className="text-xs text-muted-foreground">Excel (.xlsx, .xls) nebo CSV soubor s hlavičkou v prvním řádku.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                <Button variant="outline" size="sm" disabled={isParsing} onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> {isParsing ? "Načítám…" : "Vybrat soubor"}
                </Button>
              </div>

              <div className="border rounded-md p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium"><ClipboardPaste className="h-4 w-4" /> Vložit text</div>
                <p className="text-xs text-muted-foreground">Vložte data oddělená čárkou, středníkem nebo tabulátorem — první řádek jako názvy sloupců.</p>
                <Textarea rows={4} value={pastedText} onChange={(e) => setPastedText(e.target.value)} placeholder={"název;obor;město\nACME s.r.o.;IT;Praha"} />
                <Button size="sm" onClick={handleParseText} disabled={!pastedText.trim()}>Zpracovat text</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "mapping" && table && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Namapujte sloupce</CardTitle>
              <CardDescription>
                Nalezeno {table.rows.length} řádků. Pro každý sloupec ze souboru vyberte odpovídající pole v CRM (povinná pole jsou označená *).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {table.headers.map((header, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-1/3 min-w-0">
                    <div className="text-sm font-medium truncate">{header || `Sloupec ${i + 1}`}</div>
                    <div className="text-xs text-muted-foreground truncate">např. {table.rows[0]?.[i] || "—"}</div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <FormSelect
                      value={mapping[i] ?? "__ignore"}
                      onChange={(v) => setMapping((prev) => ({ ...prev, [i]: v === "__ignore" ? "" : v }))}
                      options={[{ value: "__ignore", label: "Nepoužívat" }, ...fields.map((f) => ({ value: f.key, label: f.required ? `${f.label} *` : f.label }))]}
                    />
                  </div>
                </div>
              ))}
              {!requiredMapped && (
                <p className="text-xs text-destructive pt-2">
                  Namapujte všechna povinná pole: {fields.filter((f) => f.required).map((f) => f.label).join(", ")}.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Náhled</CardTitle>
              <CardDescription>{validRowCount} z {mappedRows.length} řádků je připraveno k importu.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Stav</TableHead>
                    {fields.filter((f) => Object.values(mapping).includes(f.key)).map((f) => (
                      <TableHead key={f.key}>{f.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedRows.slice(0, 8).map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{r.hasRequired ? <StatusBadge label="OK" color="emerald" /> : <StatusBadge label="Chybí pole" color="rose" />}</TableCell>
                      {fields.filter((f) => Object.values(mapping).includes(f.key)).map((f) => (
                        <TableCell key={f.key} className="text-sm">{r.obj[f.key] || "—"}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {mappedRows.length > 8 && <p className="text-xs text-muted-foreground mt-2">…a dalších {mappedRows.length - 8} řádků.</p>}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={reset}><ArrowLeft className="h-3.5 w-3.5" /> Zpět</Button>
            <Button onClick={handleImport} disabled={!requiredMapped || validRowCount === 0 || isImporting}>
              {isImporting ? "Importuji…" : `Importovat ${validRowCount} záznamů`}
            </Button>
          </div>
        </div>
      )}

      {step === "result" && result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" /> Import dokončen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border p-3">
                <div className="text-2xl font-semibold">{result.created}</div>
                <div className="text-xs text-muted-foreground">Vytvořeno záznamů</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-2xl font-semibold">{result.skipped}</div>
                <div className="text-xs text-muted-foreground">Přeskočeno (chyby)</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Přeskočené řádky</div>
                {result.errors.slice(0, 10).map((e, i) => (
                  <div key={i} className="text-xs text-muted-foreground">Řádek {e.row}: {e.reason}</div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button onClick={reset} variant="outline">Importovat další soubor</Button>
              <Button
                onClick={() => router.push({ company: "/crm/companies", contact: "/crm/contacts", lead: "/crm/leads", product: "/crm/products" }[entity])}
              >
                Zobrazit výsledky
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

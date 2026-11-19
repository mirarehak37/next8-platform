"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSpreadsheet, Upload } from "lucide-react";
import { importContentPlan } from "@/lib/actions/content-plan";
import { parseContentPlan, type ContentPlan } from "@/lib/content-plan";
import type { ContentPlanImportResult } from "@/lib/content-plan-import";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

async function readPlan(file: File): Promise<ContentPlan> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheets = Object.fromEntries(
    wb.SheetNames.map((n) => [n, XLSX.utils.sheet_to_json<string[]>(wb.Sheets[n], { header: 1, raw: false, defval: "" })]),
  );
  return parseContentPlan(sheets);
}

const czDate = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" }) : "—");

export function ContentPlanImportDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ContentPlanImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setPlan(null);
    setFileName("");
    setResult(null);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = await readPlan(file);
      if (parsed.posts.length === 0) {
        toast.error("V souboru jsem nenašel žádné příspěvky. Čekám list „Plán“ s hlavičkou „Datum“.");
        return;
      }
      setPlan(parsed);
      setFileName(file.name);
      setResult(null);
    } catch {
      toast.error("Soubor se nepodařilo přečíst. Nahrajte .xlsx s obsahovým plánem.");
    }
  }

  function submit() {
    if (!plan) return;
    startTransition(async () => {
      try {
        const res = await importContentPlan(plan);
        setResult(res);
        toast.success(`Plán nahrán: ${res.created} nových, ${res.updated} aktualizovaných.`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Import se nezdařil.");
      }
    });
  }

  const posts = plan?.posts.filter((p) => p.format !== "story") ?? [];
  const stories = plan?.posts.filter((p) => p.format === "story") ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger render={<Button size="sm" variant="outline"><Upload className="h-4 w-4" /> Import plánu</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import obsahového plánu</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Nahrajte tabulku plánu (.xlsx) s listy Plán, Stories, Týdny a pravidla a Měření. Vznikne kampaň s příspěvky,
            stories a týdenním měřením. Nahrání upravené verze plán aktualizuje, nic se nezdvojí.
          </p>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-white/10 px-4 py-5 transition-colors hover:bg-white/3">
            <FileSpreadsheet className="size-5 shrink-0 text-subtle" />
            <span className="min-w-0 flex-1 truncate">{fileName || "Vybrat soubor .xlsx"}</span>
            <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {plan && (
            <div className="space-y-2 rounded-lg bg-white/3 p-3 outline-1 -outline-offset-1 outline-white/6">
              <div className="font-medium">{plan.campaign.name}</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-lg font-medium tabular-nums">{posts.length}</div><div className="caption-style text-subtle">příspěvků</div></div>
                <div><div className="text-lg font-medium tabular-nums">{stories.length}</div><div className="caption-style text-subtle">stories</div></div>
                <div><div className="text-lg font-medium tabular-nums">{plan.weeks.length}</div><div className="caption-style text-subtle">týdnů</div></div>
              </div>
              <div className="caption-style text-subtle">
                {czDate(plan.campaign.startDate)} – {czDate(plan.campaign.endDate)} · Instagram a Facebook
              </div>
            </div>
          )}
          {result && (
            <p className="text-soft">
              Hotovo: {result.created} nových, {result.updated} aktualizovaných, {result.weeks} týdnů.{" "}
              <Link href={`/marketing/campaigns/${result.campaignId}`} className="text-foreground underline underline-offset-2" onClick={() => setOpen(false)}>
                Otevřít kampaň
              </Link>
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!plan || pending || !!result}>
            {pending ? "Nahrávám…" : "Nahrát plán"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

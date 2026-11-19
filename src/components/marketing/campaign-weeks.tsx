"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { updateMarketingWeek } from "@/lib/actions/content-plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export type WeekRow = {
  id: string;
  week: number;
  startDate: string | null;
  endDate: string | null;
  theme: string | null;
  planned: number;
  published: number;
  reach: number | null;
  saves: number | null;
  shares: number | null;
  newFollowers: number | null;
  bioClicks: number | null;
  newTeams: number | null;
  bestPost: string | null;
  nextChange: string | null;
};

const METRICS = [
  ["reach", "Dosah"],
  ["saves", "Uložení"],
  ["shares", "Sdílení"],
  ["newFollowers", "Noví sledující"],
  ["bioClicks", "Kliky v biu"],
  ["newTeams", "Nové týmy"],
] as const;

const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString("cs-CZ"));
const range = (a: string | null, b: string | null) =>
  [a, b].map((d) => (d ? new Date(d).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", timeZone: "UTC" }) : "?")).join(" – ");

export function CampaignWeeks({ weeks, canEdit }: { weeks: WeekRow[]; canEdit: boolean }) {
  const total = (k: (typeof METRICS)[number][0] | "planned" | "published") => weeks.reduce((s, w) => s + (w[k] ?? 0), 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-sm">
        <thead>
          <tr className="border-b text-xs text-subtle">
            <th className="h-[38px] px-3 text-left font-normal">Týden</th>
            <th className="h-[38px] px-3 text-left font-normal">Témata</th>
            <th className="h-[38px] px-3 text-right font-normal">Publikováno</th>
            {METRICS.map(([, label]) => (
              <th key={label} className="h-[38px] px-3 text-right font-normal whitespace-nowrap">{label}</th>
            ))}
            <th className="h-[38px] px-3 text-left font-normal">Nejlepší / co změnit</th>
            {canEdit && <th className="w-10" />}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.id} className="border-b align-top hover:bg-white/3">
              <td className="px-3 py-2.5 whitespace-nowrap">
                <div className="font-medium">{w.week}. týden</div>
                <div className="caption-style mt-1 text-subtle">{range(w.startDate, w.endDate)}</div>
              </td>
              <td className="max-w-[280px] px-3 py-2.5 text-xs leading-snug whitespace-pre-line text-soft">{w.theme ?? "—"}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {w.published}<span className="text-subtle"> / {w.planned}</span>
              </td>
              {METRICS.map(([k]) => (
                <td key={k} className="px-3 py-2.5 text-right tabular-nums">{fmt(w[k])}</td>
              ))}
              <td className="max-w-[220px] px-3 py-2.5 text-xs leading-snug text-soft">
                {[w.bestPost && `★ ${w.bestPost}`, w.nextChange && `→ ${w.nextChange}`].filter(Boolean).join("\n") || "—"}
              </td>
              {canEdit && (
                <td className="px-1 py-1.5">
                  <WeekEditDialog week={w} />
                </td>
              )}
            </tr>
          ))}
          <tr className="font-medium">
            <td className="px-3 py-2.5">Celkem</td>
            <td />
            <td className="px-3 py-2.5 text-right tabular-nums">
              {total("published")}<span className="text-subtle"> / {total("planned")}</span>
            </td>
            {METRICS.map(([k]) => (
              <td key={k} className="px-3 py-2.5 text-right tabular-nums">{total(k).toLocaleString("cs-CZ")}</td>
            ))}
            <td colSpan={canEdit ? 2 : 1} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function WeekEditDialog({ week }: { week: WeekRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(form: FormData) {
    const data = Object.fromEntries([...METRICS.map(([k]) => k), "bestPost", "nextChange"].map((k) => [k, String(form.get(k) ?? "")]));
    startTransition(async () => {
      try {
        await updateMarketingWeek(week.id, data);
        toast.success(`${week.week}. týden uložen.`);
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Uložení se nezdařilo.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Upravit ${week.week}. týden`}><Pencil className="size-3.5" /></Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{week.week}. týden · {range(week.startDate, week.endDate)}</DialogTitle>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <p className="caption-style text-subtle">Čísla doplňte každé pondělí ze statistik Instagramu a Facebooku.</p>
          <div className="grid grid-cols-2 gap-3">
            {METRICS.map(([k, label]) => (
              <label key={k} className="space-y-1.5 text-sm">
                <span className="text-xs text-subtle">{label}</span>
                <Input name={k} type="number" min={0} defaultValue={week[k] ?? ""} />
              </label>
            ))}
          </div>
          <label className="block space-y-1.5 text-sm">
            <span className="text-xs text-subtle">Nejlepší příspěvek</span>
            <Input name="bestPost" defaultValue={week.bestPost ?? ""} />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-xs text-subtle">Co příště změnit</span>
            <Textarea name="nextChange" rows={2} defaultValue={week.nextChange ?? ""} />
          </label>
          <DialogFooter>
            <Button type="submit" disabled={pending}>{pending ? "Ukládám…" : "Uložit"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

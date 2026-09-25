import Link from "next/link";
import type { CalendarEntry } from "@/lib/calendar-items";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = {
  brand: "bg-[#FF1947]", sky: "bg-sky-500", violet: "bg-violet-500", indigo: "bg-indigo-500", amber: "bg-amber-500",
  emerald: "bg-emerald-500", rose: "bg-rose-500", default: "bg-muted-foreground",
};

// Next 7 days from the shared calendar. `today` is Prague wall-clock midnight.
export function WeekAgenda({ entries, today }: { entries: CalendarEntry[]; today: Date }) {
  const days = Array.from({ length: 7 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
  const onDay = (d: Date) => {
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return entries.filter((e) => e.start < next && (e.end ?? e.start) >= d);
  };
  const total = days.reduce((s, d) => s + onDay(d).length, 0);

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold">Tento týden</h3>
          <p className="text-sm text-muted-foreground">Akce, úkoly, schůzky, posty a termíny celého týmu · {total} položek</p>
        </div>
        <Link href="/calendar" className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap">Kalendář →</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
        {days.map((d, i) => {
          const items = onDay(d);
          return (
            <div key={i} className={cn("rounded-md border p-2 min-h-[64px] lg:min-h-[140px]", i === 0 && "border-[#FF1947]/60 bg-[#FF1947]/5", items.length === 0 && "hidden sm:block")}>
              <div className={cn("text-xs font-medium mb-1.5", i === 0 ? "text-[#c4002a] dark:text-[#FF1947]" : "text-muted-foreground")}>
                {i === 0 ? "Dnes" : i === 1 ? "Zítra" : d.toLocaleDateString("cs-CZ", { weekday: "short" })} {d.getDate()}. {d.getMonth() + 1}.
              </div>
              <div className="space-y-1">
                {items.length === 0 && <div className="text-[11px] text-muted-foreground/60">—</div>}
                {items.slice(0, 6).map((e, j) => {
                  const time = e.timed ? `${String(e.start.getHours()).padStart(2, "0")}:${String(e.start.getMinutes()).padStart(2, "0")}` : null;
                  const body = (
                    <>
                      <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", DOT[e.tone ?? "default"])} />
                      <span className="min-w-0 break-words">{time && <span className="text-muted-foreground">{time} </span>}{e.label}</span>
                    </>
                  );
                  return e.href ? (
                    <Link key={j} href={e.href} title={e.title ?? e.label} className="flex gap-1.5 text-[11px] leading-snug hover:underline">{body}</Link>
                  ) : (
                    <div key={j} title={e.title ?? e.label} className="flex gap-1.5 text-[11px] leading-snug">{body}</div>
                  );
                })}
                {items.length > 6 && <Link href="/calendar" className="block text-[11px] text-muted-foreground hover:text-foreground">+{items.length - 6} další</Link>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

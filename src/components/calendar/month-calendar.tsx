import Link from "next/link";
import { cn } from "@/lib/utils";

export type CalendarItem = { label: string; href?: string; tone?: "default" | "sky" | "violet" | "indigo" | "emerald" | "rose" | "amber" | "brand"; title?: string };

const TONES: Record<NonNullable<CalendarItem["tone"]>, string> = {
  default: "bg-muted",
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300",
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  brand: "bg-[#FF1947]/15 text-[#c4002a] dark:text-[#FF1947]",
};

export function monthRange(y?: string, m?: string, now = new Date()) {
  const year = y ? Number(y) : now.getFullYear();
  const month = m ? Number(m) - 1 : now.getMonth();
  return { year, month, start: new Date(year, month, 1), end: new Date(year, month + 1, 1) };
}

function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// Adds an item to every day of [start, end] that falls inside the displayed month.
export function addToDays(byDay: Map<number, CalendarItem[]>, year: number, month: number, start: Date, end: Date | null, item: CalendarItem) {
  const from = new Date(Math.max(start.getTime(), new Date(year, month, 1).getTime()));
  const to = new Date(Math.min((end ?? start).getTime(), new Date(year, month + 1, 0, 23, 59).getTime()));
  for (const d = new Date(from.getFullYear(), from.getMonth(), from.getDate()); d <= to; d.setDate(d.getDate() + 1)) {
    if (d.getMonth() !== month) continue;
    const day = d.getDate();
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(item);
  }
}

export function MonthNav({ basePath, year, month, extraQuery = "" }: { basePath: string; year: number; month: number; extraQuery?: string }) {
  const now = new Date();
  const prev = month === 0 ? { y: year - 1, m: 12 } : { y: year, m: month };
  const next = month === 11 ? { y: year + 1, m: 1 } : { y: year, m: month + 2 };
  const q = extraQuery ? `&${extraQuery}` : "";
  return (
    <div className="flex gap-2">
      <Link href={`${basePath}?y=${prev.y}&m=${prev.m}${q}`} className="text-sm px-3 py-1.5 rounded-md border hover:bg-muted">‹ <span className="hidden sm:inline">Předchozí</span></Link>
      <Link href={`${basePath}?y=${now.getFullYear()}&m=${now.getMonth() + 1}${q}`} className="text-sm px-3 py-1.5 rounded-md border hover:bg-muted">Dnes</Link>
      <Link href={`${basePath}?y=${next.y}&m=${next.m}${q}`} className="text-sm px-3 py-1.5 rounded-md border hover:bg-muted"><span className="hidden sm:inline">Další</span> ›</Link>
    </div>
  );
}

export function MonthCalendar({ year, month, byDay, maxPerDay = 3 }: { year: number; month: number; byDay: Map<number, CalendarItem[]>; maxPerDay?: number }) {
  const now = new Date();
  const todayKey = now.getFullYear() === year && now.getMonth() === month ? now.getDate() : -1;
  const cells = monthGrid(year, month);
  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border min-w-[640px]">
        {["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].map((d) => (
          <div key={d} className="bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground text-center">{d}</div>
        ))}
        {cells.map((date, i) => {
          const items = date ? byDay.get(date.getDate()) ?? [] : [];
          return (
            <div key={i} className={cn("bg-background min-h-[110px] p-1.5", !date && "bg-muted/30")}>
              {date && (
                <>
                  <div className={cn("text-xs mb-1 h-5 w-5 flex items-center justify-center rounded-full", date.getDate() === todayKey ? "bg-[#FF1947] text-white font-medium" : "text-muted-foreground")}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {items.slice(0, maxPerDay).map((item, idx) => <Chip key={idx} item={item} />)}
                    {items.length > maxPerDay && (
                      <details className="group">
                        <summary className="cursor-pointer list-none text-[10px] text-muted-foreground px-1 hover:text-foreground group-open:hidden">+{items.length - maxPerDay} další</summary>
                        <div className="space-y-1">{items.slice(maxPerDay).map((item, idx) => <Chip key={idx} item={item} />)}</div>
                      </details>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ item }: { item: CalendarItem }) {
  const cls = cn("block text-[10px] leading-tight px-1 py-0.5 rounded truncate", TONES[item.tone ?? "default"]);
  return item.href ? (
    <Link href={item.href} className={cn(cls, "hover:opacity-80")} title={item.title ?? item.label}>{item.label}</Link>
  ) : (
    <div className={cls} title={item.title ?? item.label}>{item.label}</div>
  );
}

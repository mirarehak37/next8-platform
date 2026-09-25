import Link from "next/link";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { MonthCalendar, MonthNav, addToDays, monthRange, type CalendarItem } from "@/components/calendar/month-calendar";
import { CALENDAR_KINDS, allowedKinds, loadCalendarEntries, parseKinds, type CalendarKind } from "@/lib/calendar-items";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = {
  brand: "bg-[#FF1947]", sky: "bg-sky-500", violet: "bg-violet-500", indigo: "bg-indigo-500", amber: "bg-amber-500",
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string; f?: string; mine?: string }> }) {
  const { y, m, f, mine } = await searchParams;
  const session = await auth();
  const user = session!.user;

  const { year, month, start, end } = monthRange(y, m);
  const allowed = allowedKinds(user.role);
  const kinds = parseKinds(f, user.role);
  const onlyMine = mine === "1";
  // Pad by a day each side so items near midnight UTC still land in the right Prague day.
  const entries = await loadCalendarEntries(user, new Date(start.getTime() - 86400000), new Date(end.getTime() + 86400000), { kinds, mine: onlyMine });

  const byDay = new Map<number, CalendarItem[]>();
  for (const e of entries) {
    const time = e.timed ? `${String(e.start.getHours()).padStart(2, "0")}:${String(e.start.getMinutes()).padStart(2, "0")} ` : "";
    addToDays(byDay, year, month, e.start, e.end, { ...e, label: `${time}${e.label}` });
  }

  const query = (next: { f?: CalendarKind[]; mine?: boolean }) => {
    const p = new URLSearchParams({ y: String(year), m: String(month + 1) });
    const fk = next.f ?? kinds;
    if (fk.length && fk.length < allowed.length) p.set("f", fk.join(","));
    if (next.mine ?? onlyMine) p.set("mine", "1");
    return `/calendar?${p}`;
  };
  const extra = new URLSearchParams();
  if (f) extra.set("f", f);
  if (onlyMine) extra.set("mine", "1");

  return (
    <div>
      <PageHeader
        title="Kalendář"
        description={start.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" })}
        breadcrumbs={[{ label: "Kalendář" }]}
        actions={<MonthNav basePath="/calendar" year={year} month={month} extraQuery={extra.toString()} />}
      />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={query({ f: allowed })}
            className={cn("rounded-full border px-3 py-1 text-xs", kinds.length === allowed.length ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:bg-muted")}
          >
            Vše
          </Link>
          {CALENDAR_KINDS.filter((k) => allowed.includes(k.value)).map((k) => {
            const on = kinds.includes(k.value) && kinds.length < allowed.length;
            // Clicking a chip while showing everything isolates it; otherwise it toggles.
            const next = kinds.length === allowed.length ? [k.value] : on ? kinds.filter((x) => x !== k.value) : [...kinds, k.value];
            return (
              <Link
                key={k.value}
                href={query({ f: next.length ? next : allowed })}
                className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs", on ? "border-foreground bg-muted font-medium" : "text-muted-foreground hover:bg-muted")}
              >
                <span className={cn("h-2 w-2 rounded-full", DOT[k.tone])} /> {k.label}
              </Link>
            );
          })}
          <Link
            href={query({ mine: !onlyMine })}
            className={cn("sm:ml-auto rounded-full border px-3 py-1 text-xs", onlyMine ? "border-[#FF1947] bg-[#FF1947]/10 text-[#c4002a] dark:text-[#FF1947] font-medium" : "text-muted-foreground hover:bg-muted")}
          >
            {onlyMine ? "✓ Jen moje" : "Jen moje"}
          </Link>
        </div>
        <MonthCalendar year={year} month={month} byDay={byDay} maxPerDay={4} />
        <p className="text-xs text-muted-foreground">
          ✓ hotovo · ⚠ po termínu · ✎ příspěvek ještě není připravený · ⏰ termín splnění. Kliknutím na položku otevřete detail.
        </p>
      </div>
    </div>
  );
}

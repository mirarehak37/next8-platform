import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { EventFormDialog } from "@/components/events/event-form-dialog";
import { EVENT_STATUSES, EVENT_TYPES, findMeta } from "@/lib/constants";
import { eventDateLabel, eventStats } from "@/lib/events";
import { formatCurrency } from "@/lib/format";
import { CalendarDays, MapPin, Tent, Users, Wallet, Banknote } from "lucide-react";

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const session = await auth();
  const user = session!.user;
  if (!can(user.role, "event", "view")) redirect("/dashboard");

  const today = new Date(new Date().toDateString());
  const [events, owners, companies] = await Promise.all([
    prisma.event.findMany({
      where: { tenantId: user.tenantId },
      include: { company: { select: { name: true } }, registrations: { select: { role: true, status: true, paymentStatus: true, amount: true } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const isPast = (e: (typeof events)[number]) => (e.endDate ?? e.startDate) < today || e.status === "done" || e.status === "cancelled";
  const upcoming = events.filter((e) => !isPast(e));
  const past = events.filter(isPast).reverse();
  const list = show === "past" ? past : upcoming;

  const upcomingStats = upcoming.map((e) => eventStats(e.registrations, e.capacity));
  const registered = upcomingStats.reduce((s, x) => s + x.participants, 0);
  const unpaid = events.map((e) => eventStats(e.registrations, e.capacity)).reduce((s, x) => s + x.unpaid, 0);
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const revenueYear = events.filter((e) => e.startDate >= yearStart).map((e) => eventStats(e.registrations, e.capacity)).reduce((s, x) => s + x.paid, 0);

  return (
    <div>
      <PageHeader
        title="Akce a kempy"
        description={`${upcoming.length} nadcházejících akcí`}
        breadcrumbs={[{ label: "Akce a kempy" }]}
        actions={can(user.role, "event", "create") ? <EventFormDialog owners={owners} companies={companies} currentUserId={user.id} /> : null}
      />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Nadcházející akce" value={String(upcoming.length)} icon={Tent} />
          <KpiCard label="Přihlášení účastníci" value={String(registered)} hint="na nadcházejících akcích" icon={Users} />
          <KpiCard label="Nezaplaceno" value={formatCurrency(unpaid)} icon={Wallet} />
          <KpiCard label={`Tržby ${today.getFullYear()}`} value={formatCurrency(revenueYear)} hint="zaplacené přihlášky" icon={Banknote} />
        </div>

        <div className="flex gap-1 rounded-lg border p-1 w-fit text-sm">
          <Link href="/events" className={`rounded-md px-3 py-1 ${show !== "past" ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:bg-muted"}`}>Nadcházející ({upcoming.length})</Link>
          <Link href="/events?show=past" className={`rounded-md px-3 py-1 ${show === "past" ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:bg-muted"}`}>Proběhlé ({past.length})</Link>
        </div>

        {list.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground border rounded-md border-dashed">
            {show === "past" ? "Zatím žádné proběhlé akce." : "Žádné nadcházející akce. Založte kemp, testování nebo workshop."}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((e) => {
            const type = findMeta(EVENT_TYPES, e.type);
            const status = findMeta(EVENT_STATUSES, e.status);
            const st = eventStats(e.registrations, e.capacity);
            return (
              <Link key={e.id} href={`/events/${e.id}`}>
                <Card className="h-full hover:bg-muted/40 transition-colors">
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {type && <StatusBadge label={type.label} color={type.color} />}
                      {status && <StatusBadge label={status.label} color={status.color} />}
                    </div>
                    <div className="font-semibold leading-tight">{e.name}</div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {eventDateLabel(e.startDate, e.endDate)}</div>
                      {(e.location || e.company) && (
                        <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {[e.location, e.company?.name].filter(Boolean).join(" · ")}</div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Přihlášeno</span>
                        <span className="font-medium">{st.participants}{e.capacity ? ` / ${e.capacity}` : ""}</span>
                      </div>
                      {st.fill !== null && (
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={st.fill >= 1 ? "h-full bg-amber-500" : "h-full bg-[#FF1947]"} style={{ width: `${Math.round(st.fill * 100)}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between text-xs pt-2 border-t">
                      <span className="text-muted-foreground">{e.price ? `${formatCurrency(e.price)} / osoba` : "Zdarma"}</span>
                      {st.unpaid > 0 && <span className="text-amber-600 font-medium">nezaplaceno {formatCurrency(st.unpaid)}</span>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

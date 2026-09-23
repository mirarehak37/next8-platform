import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatDate, initials } from "@/lib/format";
import { findMeta, TASK_PRIORITIES, ACTIVITY_TYPES } from "@/lib/constants";
import { Phone, Mail, Users, Video, StickyNote, Presentation, CircleDot, type LucideIcon } from "lucide-react";

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  phone: Phone, mail: Mail, users: Users, video: Video, "sticky-note": StickyNote, presentation: Presentation, "circle-dot": CircleDot,
};

export function MyTasksWidget({
  tasks,
}: {
  tasks: { id: string; title: string; dueDate: Date | null; priority: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Moje dnešní úkoly</CardTitle>
        <CardDescription>{tasks.length} úkolů k vyřízení dnes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {tasks.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Na dnešek nemáte žádné úkoly. 🎉</p>}
        {tasks.map((task) => {
          const prio = findMeta(TASK_PRIORITIES, task.priority);
          return (
            <Link
              key={task.id}
              href="/tasks"
              className="flex items-center justify-between gap-2 rounded-md px-2 py-2 -mx-2 hover:bg-muted/60 transition-colors"
            >
              <span className="text-sm truncate">{task.title}</span>
              {prio && <StatusBadge label={prio.label} color={prio.color} />}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function ActivityFeedWidget({
  activities,
}: {
  activities: { id: string; type: string; subject: string; ownerName: string; activityAt: Date }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Poslední aktivity</CardTitle>
        <CardDescription>Napříč celým týmem</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {activities.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Zatím žádné aktivity.</p>}
        {activities.map((a) => {
          const meta = findMeta(ACTIVITY_TYPES, a.type);
          const Icon = ACTIVITY_ICONS[meta?.icon ?? "circle-dot"];
          return (
            <div key={a.id} className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground mt-0.5">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{a.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {a.ownerName} · {formatDate(a.activityAt)}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function TopPerformersWidget({
  performers,
}: {
  performers: { name: string; wonValue: number; wonCount: number }[];
}) {
  const max = Math.max(...performers.map((p) => p.wonValue), 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nejlepší obchodníci</CardTitle>
        <CardDescription>Podle vyhrané hodnoty (posledních 90 dní)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {performers.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Zatím žádná data.</p>}
        {performers.map((p, i) => (
          <div key={p.name} className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground w-4">{i + 1}.</span>
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-[11px] bg-[#FF1947] text-white">{initials(p.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate font-medium">{p.name}</span>
                <span className="text-muted-foreground text-xs">{formatCurrency(p.wonValue)}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted mt-1 overflow-hidden">
                <div className="h-full rounded-full bg-[#FF1947]" style={{ width: `${(p.wonValue / max) * 100}%` }} />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function StaleDealsWidget({
  deals,
}: {
  deals: { id: string; name: string; value: number; companyName: string | null; daysSinceActivity: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Obchody bez aktivity</CardTitle>
        <CardDescription>Otevřené obchody bez kontaktu 14+ dní</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {deals.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Vše je pod kontrolou. 👍</p>}
        {deals.map((d) => (
          <Link
            key={d.id}
            href={`/crm/deals/${d.id}`}
            className="flex items-center justify-between gap-2 rounded-md px-2 py-2 -mx-2 hover:bg-muted/60 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm truncate">{d.name}</p>
              <p className="text-xs text-muted-foreground truncate">{d.companyName}</p>
            </div>
            <StatusBadge label={`${d.daysSinceActivity} dní`} color="amber" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

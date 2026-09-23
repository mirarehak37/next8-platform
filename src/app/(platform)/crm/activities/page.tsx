import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ownerScopeWhere } from "@/lib/scope";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ActivityFormDialog } from "@/components/crm/activity-form-dialog";
import { ACTIVITY_TYPES, findMeta } from "@/lib/constants";
import { formatDateTime, initials } from "@/lib/format";
import { Phone, Mail, Users, Video, StickyNote, Presentation, CircleDot, type LucideIcon } from "lucide-react";

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  phone: Phone, mail: Mail, users: Users, video: Video, "sticky-note": StickyNote, presentation: Presentation, "circle-dot": CircleDot,
};

export default async function ActivitiesPage() {
  const session = await auth();
  const user = session!.user;

  const scope = await ownerScopeWhere(user, "activity");
  const [activities, companies, deals] = await Promise.all([
    prisma.activity.findMany({ where: scope, include: { owner: { select: { name: true } } }, orderBy: { activityAt: "desc" }, take: 100 }),
    prisma.company.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.deal.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const subjectIds = { company: new Map<string, string>(), deal: new Map<string, string>() };
  companies.forEach((c) => subjectIds.company.set(c.id, c.name));
  deals.forEach((d) => subjectIds.deal.set(d.id, d.name));

  const grouped = new Map<string, typeof activities>();
  for (const a of activities) {
    const key = new Date(a.activityAt).toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" });
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(a);
  }

  return (
    <div>
      <PageHeader
        title="Aktivity"
        description={`${activities.length} aktivit`}
        breadcrumbs={[{ label: "CRM" }, { label: "Aktivity" }]}
        actions={<ActivityFormDialog companies={companies} deals={deals} />}
      />
      <div className="p-6 max-w-3xl space-y-8">
        {activities.length === 0 && <p className="text-sm text-muted-foreground">Zatím žádné aktivity.</p>}
        {Array.from(grouped.entries()).map(([day, items]) => (
          <div key={day}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{day}</h3>
            <div className="space-y-2">
              {items.map((a) => {
                const meta = findMeta(ACTIVITY_TYPES, a.type);
                const Icon = ACTIVITY_ICONS[meta?.icon ?? "circle-dot"];
                const subjectLabel = a.subjectType && a.subjectId ? subjectIds[a.subjectType as "company" | "deal"]?.get(a.subjectId) : null;
                const subjectHref = a.subjectType === "company" ? `/crm/companies/${a.subjectId}` : a.subjectType === "deal" ? `/crm/deals/${a.subjectId}` : null;
                return (
                  <Card key={a.id}>
                    <CardContent className="flex items-start gap-3 py-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{a.subject}</p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(a.activityAt)}</span>
                        </div>
                        {a.description && <p className="text-sm text-muted-foreground mt-0.5">{a.description}</p>}
                        <div className="flex items-center gap-2 mt-1.5">
                          <Avatar className="h-4 w-4"><AvatarFallback className="text-[8px]">{initials(a.owner.name)}</AvatarFallback></Avatar>
                          <span className="text-xs text-muted-foreground">{a.owner.name}</span>
                          {subjectLabel && subjectHref && (
                            <>
                              <span className="text-xs text-muted-foreground">·</span>
                              <Link href={subjectHref} className="text-xs text-[#FF1947] hover:underline">{subjectLabel}</Link>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { todayDateOnly } from "@/lib/format";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ownerScopeWhere } from "@/lib/scope";
import { loadSlippingDeals } from "@/lib/deal-insights";
import { Sidebar, type SidebarData } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const tenantId = user.tenantId;

  const [companyScope, contactScope, leadScope, dealScope] = await Promise.all([
    ownerScopeWhere(user, "company"),
    ownerScopeWhere(user, "contact"),
    ownerScopeWhere(user, "lead"),
    ownerScopeWhere(user, "deal"),
  ]);

  const todayStart = todayDateOnly();
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const myOpenTasks = { tenantId, assigneeId: user.id, status: { in: ["open", "in_progress"] } };

  const [
    tenant,
    disabledModules,
    overdueCount,
    overdueTasks,
    dueToday,
    companies,
    contacts,
    leads,
    openDeals,
    myTasks,
    teams,
    pipelines,
    slipping,
  ] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
    prisma.tenantModule.findMany({
      where: { tenantId, enabled: false },
      include: { module: true },
      orderBy: { module: { order: "asc" } },
    }),
    prisma.task.count({ where: { ...myOpenTasks, dueDate: { lt: todayStart } } }),
    prisma.task.findMany({
      where: { ...myOpenTasks, dueDate: { lt: todayStart } },
      orderBy: { dueDate: "asc" },
      select: { id: true, title: true, dueDate: true },
      take: 5,
    }),
    prisma.task.findMany({
      where: { ...myOpenTasks, dueDate: { gte: todayStart, lt: tomorrowStart } },
      orderBy: { dueDate: "asc" },
      select: { id: true, title: true, dueDate: true },
      take: 5,
    }),
    prisma.company.count({ where: companyScope }),
    prisma.contact.count({ where: contactScope }),
    prisma.lead.count({ where: { ...leadScope, status: { not: "converted" } } }),
    prisma.deal.count({ where: { ...dealScope, status: "open" } }),
    prisma.task.count({ where: myOpenTasks }),
    prisma.team.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.pipeline.findMany({
      where: { tenantId },
      select: { id: true, name: true, isDefault: true },
      orderBy: [{ isDefault: "desc" }, { order: "asc" }],
    }),
    loadSlippingDeals(dealScope, tenantId),
  ]);

  const sidebar: SidebarData = {
    role: user.role,
    tenantName: tenant?.name ?? "",
    futureModules: disabledModules.map((m) => ({ name: m.module.name, icon: m.module.icon })),
    counts: { companies, contacts, leads, openDeals, myTasks, slipping: slipping.length },
    teams,
    pipelines,
    overdueTasks: overdueCount,
  };

  const toTask = (t: { id: string; title: string; dueDate: Date | null }) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate?.toISOString() ?? null,
  });

  return (
    <div className="flex h-dvh max-w-full overflow-hidden">
      <Suspense fallback={<aside className="hidden w-(--sidebar-width) shrink-0 border-r bg-sidebar lg:block" />}>
        <Sidebar data={sidebar} />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<div className="h-[58px] shrink-0" />}>
          <Topbar
            userName={user.name ?? "Uživatel"}
            role={user.role}
            jobTitle={user.jobTitle}
            overdue={overdueTasks.map(toTask)}
            dueToday={dueToday.map(toTask)}
            sidebar={sidebar}
          />
        </Suspense>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

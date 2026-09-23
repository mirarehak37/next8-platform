import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { redirect } from "next/navigation";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [disabledModules, overdueTasks] = await Promise.all([
    prisma.tenantModule.findMany({
      where: { tenantId: session.user.tenantId, enabled: false },
      include: { module: true },
      orderBy: { module: { order: "asc" } },
    }),
    prisma.task.count({
      where: {
        tenantId: session.user.tenantId,
        assigneeId: session.user.id,
        status: { in: ["open", "in_progress"] },
        dueDate: { lt: new Date() },
      },
    }),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        role={session.user.role}
        futureModules={disabledModules.map((m) => ({ name: m.module.name, icon: m.module.icon }))}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          userName={session.user.name ?? "Uživatel"}
          role={session.user.role}
          jobTitle={session.user.jobTitle}
          overdueTasks={overdueTasks}
        />
        <main className="flex-1 min-w-0 bg-muted/20">{children}</main>
      </div>
    </div>
  );
}

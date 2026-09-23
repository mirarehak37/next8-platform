import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ownerScopeWhere } from "@/lib/scope";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TasksTable, type TaskRow } from "./tasks-table";
import { TasksKanban } from "./tasks-kanban";

export default async function TasksPage() {
  const session = await auth();
  const user = session!.user;

  const scope = await ownerScopeWhere(user, "task", "assigneeId");
  const tasks = await prisma.task.findMany({
    where: scope,
    include: { assignee: { select: { id: true, name: true } } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
  const assignees = await prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const rows: TaskRow[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    assigneeId: t.assigneeId,
    assigneeName: t.assignee.name,
    dueDate: t.dueDate?.toISOString() ?? null,
    priority: t.priority,
    status: t.status,
    subjectType: t.subjectType,
    subjectId: t.subjectId,
    isOverdue: !!t.dueDate && t.dueDate < now && t.status !== "done" && t.status !== "cancelled",
  }));

  const myRows = rows.filter((r) => r.assigneeId === user.id);
  const todayRows = rows.filter((r) => r.dueDate && new Date(r.dueDate) >= todayStart && new Date(r.dueDate) < todayEnd);
  const weekRows = rows.filter((r) => r.dueDate && new Date(r.dueDate) >= todayStart && new Date(r.dueDate) < weekEnd);
  const overdueRows = rows.filter((r) => r.isOverdue);

  return (
    <div>
      <PageHeader title="Úkoly" description={`${rows.length} úkolů celkem · ${overdueRows.length} po termínu`} breadcrumbs={[{ label: "Úkoly" }]} />
      <div className="p-6">
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">Vše ({rows.length})</TabsTrigger>
            <TabsTrigger value="mine">Moje ({myRows.length})</TabsTrigger>
            <TabsTrigger value="today">Dnes ({todayRows.length})</TabsTrigger>
            <TabsTrigger value="week">Tento týden ({weekRows.length})</TabsTrigger>
            <TabsTrigger value="overdue">Po termínu ({overdueRows.length})</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="pt-4"><TasksTable data={rows} assignees={assignees} /></TabsContent>
          <TabsContent value="mine" className="pt-4"><TasksTable data={myRows} assignees={assignees} /></TabsContent>
          <TabsContent value="today" className="pt-4"><TasksTable data={todayRows} assignees={assignees} /></TabsContent>
          <TabsContent value="week" className="pt-4"><TasksTable data={weekRows} assignees={assignees} /></TabsContent>
          <TabsContent value="overdue" className="pt-4"><TasksTable data={overdueRows} assignees={assignees} /></TabsContent>
          <TabsContent value="kanban" className="pt-4"><TasksKanban data={rows} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

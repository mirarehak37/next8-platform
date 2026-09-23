import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RoadmapFormDialog } from "@/components/crm/roadmap-form-dialog";
import { RoadmapKanban } from "./roadmap-kanban";
import { RoadmapTree } from "./roadmap-tree";
import { RoadmapTable } from "./roadmap-table";
import { RoadmapTimeline } from "./roadmap-timeline";
import type { RoadmapItemRow } from "./types";
import { KanbanSquare, GitBranch, List, CalendarRange } from "lucide-react";

export default async function RoadmapPage() {
  const session = await auth();
  const user = session!.user;

  const [items, owners, modules] = await Promise.all([
    prisma.roadmapItem.findMany({
      where: { tenantId: user.tenantId },
      include: { owner: { select: { name: true } }, module: { select: { name: true } }, _count: { select: { children: true } } },
      orderBy: [{ votes: "desc" }, { createdAt: "desc" }],
    }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.module.findMany({ select: { id: true, name: true }, orderBy: { order: "asc" } }),
  ]);

  const rows: RoadmapItemRow[] = items.map((i) => ({
    id: i.id,
    title: i.title,
    description: i.description,
    type: i.type,
    status: i.status,
    priority: i.priority,
    effort: i.effort,
    votes: i.votes,
    targetQuarter: i.targetQuarter,
    moduleId: i.moduleId,
    moduleName: i.module?.name ?? null,
    parentId: i.parentId,
    ownerId: i.ownerId,
    ownerName: i.owner.name,
    childCount: i._count.children,
    createdAt: i.createdAt.toISOString(),
  }));

  const parentCandidates = rows.filter((r) => !r.parentId).map((r) => ({ id: r.id, name: r.title }));

  return (
    <div>
      <PageHeader
        title="Roadmap"
        description={`${rows.length} nápadů, plánovaných funkcí a aktualizací platformy`}
        breadcrumbs={[{ label: "Roadmap" }]}
        actions={<RoadmapFormDialog owners={owners} modules={modules} parentCandidates={parentCandidates} />}
      />
      <div className="p-6">
        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban"><KanbanSquare className="h-3.5 w-3.5" /> Kanban</TabsTrigger>
            <TabsTrigger value="tree"><GitBranch className="h-3.5 w-3.5" /> Strom</TabsTrigger>
            <TabsTrigger value="list"><List className="h-3.5 w-3.5" /> Seznam</TabsTrigger>
            <TabsTrigger value="timeline"><CalendarRange className="h-3.5 w-3.5" /> Časová osa</TabsTrigger>
          </TabsList>
          <TabsContent value="kanban" className="pt-4">
            <RoadmapKanban data={rows} owners={owners} modules={modules} />
          </TabsContent>
          <TabsContent value="tree" className="pt-4">
            <RoadmapTree data={rows} owners={owners} modules={modules} />
          </TabsContent>
          <TabsContent value="list" className="pt-4">
            <RoadmapTable data={rows} owners={owners} modules={modules} />
          </TabsContent>
          <TabsContent value="timeline" className="pt-4">
            <RoadmapTimeline data={rows} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

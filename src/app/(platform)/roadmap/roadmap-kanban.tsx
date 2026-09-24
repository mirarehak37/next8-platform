"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, DragEndEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { toast } from "sonner";
import { moveRoadmapItem } from "@/lib/actions/roadmap";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { RoadmapFormDialog } from "@/components/crm/roadmap-form-dialog";
import { ROADMAP_STATUSES, ROADMAP_TYPES, findMeta } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ArrowBigUp, MessageSquareText } from "lucide-react";
import type { RoadmapItemRow } from "./types";

export function RoadmapKanban({
  data,
  owners,
  modules,
}: {
  data: RoadmapItemRow[];
  owners: { id: string; name: string }[];
  modules: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(data);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    setItems(data);
  }, [data]);

  const byStatus = useMemo(() => {
    const map = new Map<string, RoadmapItemRow[]>();
    for (const s of ROADMAP_STATUSES) map.set(s.value, []);
    for (const item of items) map.get(item.status)?.push(item);
    return map;
  }, [items]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const itemId = String(active.id);
    const targetStatus = String(over.id);
    const item = items.find((i) => i.id === itemId);
    if (!item || item.status === targetStatus) return;

    const prevStatus = item.status;
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, status: targetStatus } : i)));
    try {
      await moveRoadmapItem(itemId, targetStatus);
      router.refresh();
    } catch (e) {
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, status: prevStatus } : i)));
      toast.error(e instanceof Error ? e.message : "Přesun se nezdařil.");
    }
  }

  return (
    <DndContext id="roadmap-kanban" sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {ROADMAP_STATUSES.map((status) => (
          <Column key={status.value} id={status.value} title={status.label} count={(byStatus.get(status.value) ?? []).length}>
            {(byStatus.get(status.value) ?? []).map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
            {(byStatus.get(status.value) ?? []).length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-md">Přetáhněte sem</div>
            )}
            <RoadmapFormDialog
              owners={owners}
              modules={modules}
              parentCandidates={items.filter((i) => !i.parentId).map((i) => ({ id: i.id, name: i.title }))}
              defaultStatus={status.value}
              trigger={
                <button className="w-full text-xs text-muted-foreground hover:text-foreground border border-dashed rounded-md py-1.5 transition-colors">
                  + Přidat
                </button>
              }
            />
          </Column>
        ))}
      </div>
    </DndContext>
  );
}

function Column({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn("flex w-64 shrink-0 flex-col rounded-lg border bg-muted/30", isOver && "bg-[#FF1947]/10 border-[#FF1947]")}>
      <div className="px-3 py-2.5 border-b flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="flex-1 space-y-2 p-2 min-h-[120px]">{children}</div>
    </div>
  );
}

function ItemCard({ item }: { item: RoadmapItemRow }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const typeMeta = findMeta(ROADMAP_TYPES, item.type);

  return (
    <Card ref={setNodeRef} style={style} {...listeners} {...attributes} className={cn("cursor-grab active:cursor-grabbing touch-none py-0", isDragging && "opacity-60 shadow-lg")}>
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-1">
          {typeMeta && <StatusBadge label={typeMeta.label} color={typeMeta.color} />}
          {item.effort && <span className="text-[10px] text-muted-foreground uppercase">{item.effort}</span>}
        </div>
        <div className="text-sm font-medium leading-snug">{item.title}</div>
        {item.moduleName && <div className="text-xs text-muted-foreground">{item.moduleName}</div>}
        <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><ArrowBigUp className="h-3.5 w-3.5" /> {item.votes}</span>
          {item.childCount > 0 && <span className="flex items-center gap-1"><MessageSquareText className="h-3 w-3" /> {item.childCount}</span>}
          <span className="truncate max-w-[90px]">{item.ownerName}</span>
        </div>
      </CardContent>
    </Card>
  );
}

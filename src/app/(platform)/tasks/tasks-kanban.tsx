"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, DragEndEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { toast } from "sonner";
import { setTaskStatus } from "@/lib/actions/tasks";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { TASK_PRIORITIES, TASK_STATUSES, findMeta } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TaskRow } from "./tasks-table";

export function TasksKanban({ data }: { data: TaskRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(data);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const byStatus = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const s of TASK_STATUSES) map.set(s.value, []);
    for (const t of items) map.get(t.status)?.push(t);
    return map;
  }, [items]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const taskId = String(active.id);
    const targetStatus = String(over.id);
    const task = items.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    const prevStatus = task.status;
    setItems((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t)));
    try {
      await setTaskStatus(taskId, targetStatus);
      router.refresh();
    } catch (e) {
      setItems((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: prevStatus } : t)));
      toast.error(e instanceof Error ? e.message : "Přesun se nezdařil.");
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {TASK_STATUSES.map((status) => (
          <Column key={status.value} id={status.value} title={status.label} count={(byStatus.get(status.value) ?? []).length}>
            {(byStatus.get(status.value) ?? []).map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </Column>
        ))}
      </div>
    </DndContext>
  );
}

function Column({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn("flex w-64 shrink-0 flex-col rounded-lg border bg-muted/30", isOver && "bg-[#FF1947]/10 border-[#FF1947] dark:bg-[#FF1947]/10")}>
      <div className="px-3 py-2.5 border-b flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="flex-1 space-y-2 p-2 min-h-[120px]">{children}</div>
    </div>
  );
}

function TaskCard({ task }: { task: TaskRow }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const prio = findMeta(TASK_PRIORITIES, task.priority);
  return (
    <Card ref={setNodeRef} style={style} {...listeners} {...attributes} className={cn("cursor-grab active:cursor-grabbing touch-none py-0", isDragging && "opacity-60 shadow-lg")}>
      <CardContent className="p-3 space-y-1.5">
        <div className="text-sm font-medium">{task.title}</div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{task.assigneeName}</span>
          {prio && <StatusBadge label={prio.label} color={prio.color} />}
        </div>
        {task.dueDate && <div className="text-xs text-muted-foreground">Termín: {formatDate(task.dueDate)}</div>}
      </CardContent>
    </Card>
  );
}

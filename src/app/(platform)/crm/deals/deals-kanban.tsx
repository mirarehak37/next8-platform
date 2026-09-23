"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { moveDealStage } from "@/lib/actions/deals";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DealFormDialog } from "@/components/crm/deal-form-dialog";
import { formatCurrency, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export type KanbanDeal = {
  id: string;
  name: string;
  value: number;
  currency: string;
  companyName: string | null;
  ownerName: string;
  stageId: string;
  expectedCloseDate: string | null;
};

export type KanbanStage = { id: string; name: string; probability: number; isWon: boolean; isLost: boolean };

export function DealsKanban({
  stages,
  deals,
  owners,
  companies,
  pipelineId,
}: {
  stages: KanbanStage[];
  deals: KanbanDeal[];
  owners: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  pipelineId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(deals);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const byStage = useMemo(() => {
    const map = new Map<string, KanbanDeal[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const deal of items) map.get(deal.stageId)?.push(deal);
    return map;
  }, [items, stages]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const dealId = String(active.id);
    const targetStageId = String(over.id);
    const deal = items.find((d) => d.id === dealId);
    if (!deal || deal.stageId === targetStageId) return;

    const previousStageId = deal.stageId;
    setItems((prev) => prev.map((d) => (d.id === dealId ? { ...d, stageId: targetStageId } : d)));

    try {
      await moveDealStage(dealId, targetStageId);
      router.refresh();
    } catch (e) {
      setItems((prev) => prev.map((d) => (d.id === dealId ? { ...d, stageId: previousStageId } : d)));
      toast.error(e instanceof Error ? e.message : "Přesun se nezdařil.");
    }
  }

  const activeDeal = items.find((d) => d.id === activeId);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageDeals = byStage.get(stage.id) ?? [];
          const total = stageDeals.reduce((s, d) => s + d.value, 0);
          return (
            <KanbanColumn key={stage.id} stage={stage} count={stageDeals.length} total={total}>
              {stageDeals.map((deal) => (
                <KanbanCard key={deal.id} deal={deal} />
              ))}
              {stageDeals.length === 0 && <div className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-md">Přetáhněte sem obchod</div>}
              <DealFormDialog
                owners={owners}
                companies={companies}
                stages={stages}
                pipelineId={pipelineId}
                defaultStageId={stage.id}
                trigger={
                  <button className="w-full text-xs text-muted-foreground hover:text-foreground border border-dashed rounded-md py-1.5 transition-colors">
                    + Přidat obchod
                  </button>
                }
              />
            </KanbanColumn>
          );
        })}
      </div>
      <DragOverlay>{activeDeal && <KanbanCard deal={activeDeal} dragging />}</DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  stage,
  count,
  total,
  children,
}: {
  stage: KanbanStage;
  count: number;
  total: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 transition-colors",
        isOver && "bg-[#FF1947]/10 border-[#FF1947] dark:bg-[#FF1947]/10",
      )}
    >
      <div className="px-3 py-2.5 border-b">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{stage.name}</span>
          <span className="text-xs text-muted-foreground">{count}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{formatCurrency(total)}</div>
      </div>
      <div className="flex-1 space-y-2 p-2 min-h-[120px]">{children}</div>
    </div>
  );
}

function KanbanCard({ deal, dragging }: { deal: KanbanDeal; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggableCard(deal.id);
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn("cursor-grab active:cursor-grabbing touch-none py-0 gap-0", (isDragging || dragging) && "opacity-60 shadow-lg")}
    >
      <CardContent className="p-3 space-y-2">
        <Link href={`/crm/deals/${deal.id}`} className="text-sm font-medium hover:underline block" onClick={(e) => isDragging && e.preventDefault()}>
          {deal.name}
        </Link>
        {deal.companyName && <div className="text-xs text-muted-foreground">{deal.companyName}</div>}
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-semibold">{formatCurrency(deal.value, deal.currency)}</span>
          <Avatar className="h-5 w-5"><AvatarFallback className="text-[9px]">{initials(deal.ownerName)}</AvatarFallback></Avatar>
        </div>
      </CardContent>
    </Card>
  );
}

function useDraggableCard(id: string) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  return { attributes, listeners, setNodeRef, transform, isDragging };
}

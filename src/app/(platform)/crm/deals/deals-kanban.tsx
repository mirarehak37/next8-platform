"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { moveDealStage } from "@/lib/actions/deals";
import { CalendarDays } from "lucide-react";
import { DealFormDialog } from "@/components/crm/deal-form-dialog";
import type { DealFormExtras } from "@/lib/deal-form-extras";
import { Tag, stageTone } from "@/components/common/tag";
import { CountBadge } from "@/components/common/count-badge";
import { OwnerAvatar } from "@/components/common/owner-badge";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
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
  contacts = [],
  pipelineId,
  extras,
}: {
  extras?: DealFormExtras;
  stages: KanbanStage[];
  deals: KanbanDeal[];
  owners: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  contacts?: { id: string; name: string }[];
  pipelineId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(deals);
  const [activeId, setActiveId] = useState<string | null>(null);

  // `deals` is a fresh array from the server after every router.refresh() (new
  // deal created, stage moved elsewhere, etc.), but useState only reads it once
  // on mount — without this the board silently goes stale until a hard reload.
  useEffect(() => {
    setItems(deals);
  }, [deals]);
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
    <DndContext id="deals-kanban" sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageDeals = byStage.get(stage.id) ?? [];
          const total = stageDeals.reduce((s, d) => s + d.value, 0);
          return (
            <KanbanColumn key={stage.id} stage={stage} count={stageDeals.length} total={total}>
              {stageDeals.map((deal) => (
                <KanbanCard key={deal.id} deal={deal} />
              ))}
              {stageDeals.length === 0 && (
                <div className="caption-style flex h-20 items-center justify-center rounded-lg border border-dashed border-white/8 text-subtle">
                  Přetáhněte sem obchod
                </div>
              )}
              <DealFormDialog
                extras={extras}
                owners={owners}
                companies={companies}
                contacts={contacts}
                stages={stages}
                pipelineId={pipelineId}
                defaultStageId={stage.id}
                trigger={
                  <button className="w-full rounded-lg py-1.5 text-xs text-subtle transition-colors hover:bg-white/4 hover:text-foreground">
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
        "flex w-72 shrink-0 flex-col gap-3 rounded-xl bg-sidebar p-2 outline-1 -outline-offset-1 outline-white/4 transition-[outline-color] duration-150",
        isOver && "outline-brand/70",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <span className="flex min-w-0 items-center gap-2">
          <Tag tone={stageTone(stage)} className="truncate">
            {stage.name}
          </Tag>
          <CountBadge>{count}</CountBadge>
        </span>
        <span className="caption-style shrink-0 text-subtle tabular-nums">{formatCurrencyCompact(total)}</span>
      </div>
      <div className="flex min-h-[120px] flex-1 flex-col gap-2">{children}</div>
    </div>
  );
}

function KanbanCard({ deal, dragging }: { deal: KanbanDeal; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggableCard(deal.id);
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  const slipping = isPastDue(deal.expectedCloseDate);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex cursor-grab touch-none flex-col gap-3 rounded-lg bg-card p-3 outline-1 -outline-offset-1 outline-white/6 transition-opacity duration-150 active:cursor-grabbing",
        (isDragging || dragging) && "opacity-60 shadow-overlay",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/crm/deals/${deal.id}`}
          className="min-w-0 text-sm leading-tight font-medium hover:underline"
          onClick={(e) => isDragging && e.preventDefault()}
        >
          {deal.name}
        </Link>
        {slipping && (
          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-danger" title="Po termínu uzavření">
            <span className="sr-only">Po termínu uzavření</span>
          </span>
        )}
      </div>
      {deal.companyName && <div className="caption-style -mt-1 truncate text-soft">{deal.companyName}</div>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm tabular-nums">{formatCurrency(deal.value, deal.currency)}</span>
        {deal.expectedCloseDate && (
          <span className={cn("caption-style flex items-center gap-1 tabular-nums", slipping ? "text-danger" : "text-soft")}>
            <CalendarDays className="size-3" aria-hidden />
            {new Date(deal.expectedCloseDate).toLocaleDateString("cs-CZ", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 border-t pt-3">
        <OwnerAvatar name={deal.ownerName} className="size-4 text-[8px]" />
        <span className="caption-style truncate text-soft">{deal.ownerName}</span>
      </div>
    </div>
  );
}

function isPastDue(iso: string | null) {
  return iso ? new Date(iso).getTime() < Date.now() - 86_400_000 : false;
}

function useDraggableCard(id: string) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  return { attributes, listeners, setNodeRef, transform, isDragging };
}

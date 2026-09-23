"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { ROADMAP_QUARTERS, ROADMAP_STATUSES, ROADMAP_TYPES, findMeta } from "@/lib/constants";
import { ArrowBigUp } from "lucide-react";
import type { RoadmapItemRow } from "./types";

export function RoadmapTimeline({ data }: { data: RoadmapItemRow[] }) {
  const columns = useMemo(() => {
    const groups = new Map<string, RoadmapItemRow[]>();
    for (const q of ROADMAP_QUARTERS) groups.set(q, []);
    groups.set("Bez termínu", []);
    for (const item of data) {
      const key = item.targetQuarter && ROADMAP_QUARTERS.includes(item.targetQuarter as (typeof ROADMAP_QUARTERS)[number]) ? item.targetQuarter : "Bez termínu";
      groups.get(key)!.push(item);
    }
    for (const list of groups.values()) list.sort((a, b) => b.votes - a.votes);
    return groups;
  }, [data]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {Array.from(columns.entries()).map(([quarter, items]) => (
        <div key={quarter} className="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30">
          <div className="px-3 py-2.5 border-b flex items-center justify-between">
            <span className="text-sm font-medium">{quarter}</span>
            <span className="text-xs text-muted-foreground">{items.length}</span>
          </div>
          <div className="flex-1 space-y-2 p-2 min-h-[120px]">
            {items.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Žádné položky</div>}
            {items.map((item) => {
              const statusMeta = findMeta(ROADMAP_STATUSES, item.status);
              const typeMeta = findMeta(ROADMAP_TYPES, item.type);
              return (
                <Card key={item.id} className="py-0">
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex items-center gap-1 flex-wrap">
                      {typeMeta && <StatusBadge label={typeMeta.label} color={typeMeta.color} />}
                      {statusMeta && <StatusBadge label={statusMeta.label} color={statusMeta.color} />}
                    </div>
                    <div className="text-sm font-medium leading-snug">{item.title}</div>
                    {item.moduleName && <div className="text-xs text-muted-foreground">{item.moduleName}</div>}
                    <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><ArrowBigUp className="h-3.5 w-3.5" /> {item.votes}</span>
                      <span className="truncate max-w-[110px]">{item.ownerName}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

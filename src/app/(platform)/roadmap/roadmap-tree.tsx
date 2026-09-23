"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ArrowBigUp, GitBranch } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { RoadmapFormDialog, RoadmapEditTrigger } from "@/components/crm/roadmap-form-dialog";
import { ROADMAP_STATUSES, ROADMAP_TYPES, findMeta } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { RoadmapItemRow } from "./types";

export function RoadmapTree({
  data,
  owners,
  modules,
}: {
  data: RoadmapItemRow[];
  owners: { id: string; name: string }[];
  modules: { id: string; name: string }[];
}) {
  const byParent = useMemo(() => {
    const map = new Map<string | null, RoadmapItemRow[]>();
    for (const item of data) {
      const key = item.parentId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    for (const list of map.values()) list.sort((a, b) => b.votes - a.votes);
    return map;
  }, [data]);

  const roots = byParent.get(null) ?? [];
  const parentCandidates = data.filter((i) => !i.parentId).map((i) => ({ id: i.id, name: i.title }));

  if (roots.length === 0) {
    return <p className="text-sm text-muted-foreground py-10 text-center">Zatím žádné položky roadmapy.</p>;
  }

  return (
    <div className="space-y-1 max-w-3xl">
      {roots.map((item) => (
        <TreeNode key={item.id} item={item} byParent={byParent} depth={0} owners={owners} modules={modules} parentCandidates={parentCandidates} />
      ))}
    </div>
  );
}

function TreeNode({
  item,
  byParent,
  depth,
  owners,
  modules,
  parentCandidates,
}: {
  item: RoadmapItemRow;
  byParent: Map<string | null, RoadmapItemRow[]>;
  depth: number;
  owners: { id: string; name: string }[];
  modules: { id: string; name: string }[];
  parentCandidates: { id: string; name: string }[];
}) {
  const [expanded, setExpanded] = useState(true);
  const children = byParent.get(item.id) ?? [];
  const statusMeta = findMeta(ROADMAP_STATUSES, item.status);
  const typeMeta = findMeta(ROADMAP_TYPES, item.type);

  return (
    <div>
      <div className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/60 group" style={{ paddingLeft: `${depth * 24 + 8}px` }}>
        <button
          onClick={() => setExpanded((e) => !e)}
          className={cn("h-4 w-4 shrink-0 flex items-center justify-center text-muted-foreground", children.length === 0 && "invisible")}
        >
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
        </button>
        {depth > 0 && <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <span className="text-sm font-medium flex-1 min-w-0 truncate">{item.title}</span>
        {typeMeta && <StatusBadge label={typeMeta.label} color={typeMeta.color} />}
        {statusMeta && <StatusBadge label={statusMeta.label} color={statusMeta.color} />}
        {item.moduleName && <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">{item.moduleName}</span>}
        <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap"><ArrowBigUp className="h-3.5 w-3.5" />{item.votes}</span>
        <span className="text-xs text-muted-foreground whitespace-nowrap hidden md:inline truncate max-w-[100px]">{item.ownerName}</span>
        <div className="opacity-0 group-hover:opacity-100">
          <RoadmapFormDialog
            owners={owners}
            modules={modules}
            parentCandidates={parentCandidates.filter((p) => p.id !== item.id)}
            item={{
              id: item.id, title: item.title, description: item.description, type: item.type, status: item.status,
              priority: item.priority, effort: item.effort, targetQuarter: item.targetQuarter, moduleId: item.moduleId,
              parentId: item.parentId, ownerId: item.ownerId,
            }}
            trigger={<RoadmapEditTrigger />}
          />
        </div>
      </div>
      {expanded && children.map((child) => (
        <TreeNode key={child.id} item={child} byParent={byParent} depth={depth + 1} owners={owners} modules={modules} parentCandidates={parentCandidates} />
      ))}
    </div>
  );
}

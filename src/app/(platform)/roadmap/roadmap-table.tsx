"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { RoadmapFormDialog, RoadmapEditTrigger } from "@/components/crm/roadmap-form-dialog";
import { voteRoadmapItem } from "@/lib/actions/roadmap";
import { ROADMAP_STATUSES, ROADMAP_TYPES, ROADMAP_PRIORITIES, findMeta } from "@/lib/constants";
import { ArrowBigUp } from "lucide-react";
import type { RoadmapItemRow } from "./types";

export function RoadmapTable({
  data,
  owners,
  modules,
}: {
  data: RoadmapItemRow[];
  owners: { id: string; name: string }[];
  modules: { id: string; name: string }[];
}) {
  const router = useRouter();

  async function handleVote(id: string) {
    try {
      await voteRoadmapItem(id);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  const parentCandidates = data.filter((i) => !i.parentId).map((i) => ({ id: i.id, name: i.title }));

  const columns = useMemo<ColumnDef<RoadmapItemRow, unknown>[]>(
    () => [
      {
        accessorKey: "votes",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Hlasy" />,
        meta: { label: "Hlasy" },
        cell: ({ row }) => (
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => handleVote(row.original.id)}>
            <ArrowBigUp className="h-3.5 w-3.5" /> {row.original.votes}
          </Button>
        ),
      },
      {
        accessorKey: "title",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Název" />,
        meta: { label: "Název" },
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        accessorKey: "type",
        header: "Typ",
        meta: { label: "Typ" },
        cell: ({ row }) => {
          const meta = findMeta(ROADMAP_TYPES, row.original.type);
          return meta ? <StatusBadge label={meta.label} color={meta.color} /> : "—";
        },
        filterFn: (row, id, value) => value === "all" || row.getValue(id) === value,
      },
      {
        accessorKey: "status",
        header: "Stav",
        meta: { label: "Stav" },
        cell: ({ row }) => {
          const meta = findMeta(ROADMAP_STATUSES, row.original.status);
          return <StatusBadge label={meta?.label ?? row.original.status} color={meta?.color} />;
        },
        filterFn: (row, id, value) => value === "all" || row.getValue(id) === value,
      },
      {
        accessorKey: "priority",
        header: "Priorita",
        meta: { label: "Priorita" },
        cell: ({ row }) => {
          const meta = findMeta(ROADMAP_PRIORITIES, row.original.priority);
          return meta ? <StatusBadge label={meta.label} color={meta.color} /> : "—";
        },
      },
      { accessorKey: "moduleName", header: "Modul", meta: { label: "Modul" }, cell: ({ row }) => row.original.moduleName ?? "—" },
      { accessorKey: "targetQuarter", header: "Čtvrtletí", meta: { label: "Čtvrtletí" }, cell: ({ row }) => row.original.targetQuarter ?? "—" },
      { accessorKey: "ownerName", header: "Vlastník", meta: { label: "Vlastník" } },
      {
        id: "actions",
        header: "",
        meta: { label: "Akce" },
        cell: ({ row }) => (
          <RoadmapFormDialog
            owners={owners}
            modules={modules}
            parentCandidates={parentCandidates.filter((p) => p.id !== row.original.id)}
            item={{
              id: row.original.id, title: row.original.title, description: row.original.description, type: row.original.type,
              status: row.original.status, priority: row.original.priority, effort: row.original.effort,
              targetQuarter: row.original.targetQuarter, moduleId: row.original.moduleId, parentId: row.original.parentId,
              ownerId: row.original.ownerId,
            }}
            trigger={<RoadmapEditTrigger />}
          />
        ),
      },
    ],
    [owners, modules, parentCandidates],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Hledat v roadmapě…"
      exportFilename="roadmap"
      emptyMessage="Zatím žádné položky."
      facets={[
        { columnId: "status", title: "Stav", options: ROADMAP_STATUSES.map((s) => ({ value: s.value, label: s.label })) },
        { columnId: "type", title: "Typ", options: ROADMAP_TYPES.map((t) => ({ value: t.value, label: t.label })) },
      ]}
      toolbarActions={<RoadmapFormDialog owners={owners} modules={modules} parentCandidates={parentCandidates} />}
    />
  );
}

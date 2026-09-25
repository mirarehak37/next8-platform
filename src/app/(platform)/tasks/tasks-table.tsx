"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { StatusBadge } from "@/components/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskFormDialog, TaskEditTrigger } from "@/components/crm/task-form-dialog";
import { setTaskStatus } from "@/lib/actions/tasks";
import { TASK_PRIORITIES, TASK_STATUSES, findMeta } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  assigneeId: string;
  assigneeName: string;
  dueDate: string | null;
  priority: string;
  status: string;
  subjectType: string | null;
  subjectId: string | null;
  isOverdue: boolean;
};

export function TasksTable({ data, assignees }: { data: TaskRow[]; assignees: { id: string; name: string }[] }) {
  const router = useRouter();

  async function handleToggleDone(task: TaskRow, checked: boolean) {
    try {
      await setTaskStatus(task.id, checked ? "done" : "open");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Něco se pokazilo.");
    }
  }

  const columns = useMemo<ColumnDef<TaskRow, unknown>[]>(
    () => [
      {
        id: "done",
        header: "",
        meta: { label: "Hotovo" },
        cell: ({ row }) => (
          <Checkbox checked={row.original.status === "done"} onCheckedChange={(v) => handleToggleDone(row.original, !!v)} />
        ),
      },
      {
        accessorKey: "title",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Název" />,
        meta: { label: "Název" },
        cell: ({ row }) => <span className={row.original.status === "done" ? "line-through text-muted-foreground" : "font-medium"}>{row.original.title}</span>,
      },
      { accessorKey: "assigneeName", header: "Řešitel", meta: { label: "Řešitel" } },
      {
        accessorKey: "dueDate",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Termín" />,
        meta: { label: "Termín" },
        cell: ({ row }) => (
          <span className={row.original.isOverdue ? "text-rose-600 font-medium" : ""}>{formatDate(row.original.dueDate)}</span>
        ),
      },
      {
        accessorKey: "priority",
        header: "Priorita",
        meta: { label: "Priorita" },
        cell: ({ row }) => {
          const meta = findMeta(TASK_PRIORITIES, row.original.priority);
          return meta ? <StatusBadge label={meta.label} color={meta.color} /> : "—";
        },
        filterFn: (row, id, value) => value === "all" || row.getValue(id) === value,
      },
      {
        accessorKey: "status",
        header: "Stav",
        meta: { label: "Stav" },
        cell: ({ row }) => {
          const meta = findMeta(TASK_STATUSES, row.original.status);
          return <StatusBadge label={meta?.label ?? row.original.status} color={meta?.color} />;
        },
        filterFn: (row, id, value) => value === "all" || row.getValue(id) === value,
      },
      {
        id: "actions",
        header: "",
        meta: { label: "Akce" },
        cell: ({ row }) => (
          <TaskFormDialog
            assignees={assignees}
            task={{
              id: row.original.id,
              title: row.original.title,
              description: row.original.description,
              assigneeId: row.original.assigneeId,
              dueDate: row.original.dueDate?.slice(0, 10) ?? undefined,
              priority: row.original.priority,
              status: row.original.status,
            }}
            trigger={<TaskEditTrigger />}
          />
        ),
      },
    ],
    [assignees],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Hledat úkoly…"
      exportFilename="ukoly"
      emptyMessage="Žádné úkoly."
      facets={[
        { columnId: "status", title: "Stav", options: TASK_STATUSES.map((s) => ({ value: s.value, label: s.label })) },
        { columnId: "priority", title: "Priorita", options: TASK_PRIORITIES.map((p) => ({ value: p.value, label: p.label })) },
      ]}
      toolbarActions={<TaskFormDialog assignees={assignees} />}
    />
  );
}

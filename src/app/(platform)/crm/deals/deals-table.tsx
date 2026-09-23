"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { StatusBadge } from "@/components/status-badge";
import { DEAL_STATUSES, findMeta } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";

export type DealRow = {
  id: string;
  name: string;
  companyName: string | null;
  stageName: string;
  value: number;
  currency: string;
  status: string;
  probability: number | null;
  expectedCloseDate: string | null;
  ownerName: string;
};

export function DealsTable({ data }: { data: DealRow[] }) {
  const columns = useMemo<ColumnDef<DealRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Název" />,
        meta: { label: "Název" },
        cell: ({ row }) => <Link href={`/crm/deals/${row.original.id}`} className="font-medium hover:underline">{row.original.name}</Link>,
      },
      { accessorKey: "companyName", header: "Firma", meta: { label: "Firma" }, cell: ({ row }) => row.original.companyName ?? "—" },
      { accessorKey: "stageName", header: "Fáze", meta: { label: "Fáze" } },
      {
        accessorKey: "value",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Hodnota" />,
        meta: { label: "Hodnota" },
        cell: ({ row }) => formatCurrency(row.original.value, row.original.currency),
      },
      { accessorKey: "probability", header: "Pravděpodobnost", meta: { label: "Pravděpodobnost" }, cell: ({ row }) => (row.original.probability != null ? `${row.original.probability}%` : "—") },
      {
        accessorKey: "expectedCloseDate",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Očekávané uzavření" />,
        meta: { label: "Uzavření" },
        cell: ({ row }) => formatDate(row.original.expectedCloseDate),
      },
      {
        accessorKey: "status",
        header: "Stav",
        meta: { label: "Stav" },
        cell: ({ row }) => {
          const meta = findMeta(DEAL_STATUSES, row.original.status);
          return <StatusBadge label={meta?.label ?? row.original.status} color={meta?.color} />;
        },
        filterFn: (row, id, value) => value === "all" || row.getValue(id) === value,
      },
      { accessorKey: "ownerName", header: "Vlastník", meta: { label: "Vlastník" } },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Hledat obchodní případy…"
      exportFilename="obchodni-pripady"
      emptyMessage="Zatím žádné obchodní případy."
      facets={[{ columnId: "status", title: "Stav", options: DEAL_STATUSES.map((s) => ({ value: s.value, label: s.label })) }]}
    />
  );
}

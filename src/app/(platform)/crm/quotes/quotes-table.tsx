"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { StatusBadge } from "@/components/status-badge";
import { QuoteFormDialog } from "@/components/crm/quote-form-dialog";
import { QUOTE_STATUSES, findMeta } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";

export type QuoteRow = {
  id: string;
  number: string;
  companyName: string | null;
  total: number;
  currency: string;
  status: string;
  validUntil: string | null;
  ownerName: string;
};

export function QuotesTable({
  data,
  companies,
  deals,
  products,
  contacts = [],
}: {
  data: QuoteRow[];
  companies: { id: string; name: string }[];
  deals: { id: string; name: string }[];
  products: { id: string; name: string; price: number; vatRate: number }[];
  contacts?: { id: string; name: string }[];
}) {
  const columns = useMemo<ColumnDef<QuoteRow, unknown>[]>(
    () => [
      { accessorKey: "number", header: ({ column }) => <DataTableColumnHeader column={column} title="Číslo" />, meta: { label: "Číslo" }, cell: ({ row }) => <Link href={`/crm/quotes/${row.original.id}`} className="font-medium hover:underline">{row.original.number}</Link> },
      { accessorKey: "companyName", header: "Firma", meta: { label: "Firma" }, cell: ({ row }) => row.original.companyName ?? "—" },
      { accessorKey: "total", header: ({ column }) => <DataTableColumnHeader column={column} title="Celkem" />, meta: { label: "Celkem" }, cell: ({ row }) => formatCurrency(row.original.total, row.original.currency) },
      { accessorKey: "validUntil", header: "Platnost do", meta: { label: "Platnost" }, cell: ({ row }) => formatDate(row.original.validUntil) },
      {
        accessorKey: "status",
        header: "Stav",
        meta: { label: "Stav" },
        cell: ({ row }) => {
          const meta = findMeta(QUOTE_STATUSES, row.original.status);
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
      searchPlaceholder="Hledat nabídky…"
      exportFilename="nabidky"
      emptyMessage="Zatím žádné nabídky."
      facets={[{ columnId: "status", title: "Stav", options: QUOTE_STATUSES.map((s) => ({ value: s.value, label: s.label })) }]}
      toolbarActions={<QuoteFormDialog companies={companies} deals={deals} products={products} contacts={contacts} />}
    />
  );
}

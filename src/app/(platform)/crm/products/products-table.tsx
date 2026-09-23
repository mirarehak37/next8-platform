"use client";

import { useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { StatusBadge } from "@/components/status-badge";
import { ProductFormDialog, ProductEditTrigger } from "@/components/crm/product-form-dialog";
import { formatCurrency } from "@/lib/format";

export type ProductRow = {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  price: number;
  vatRate: number;
  unit: string;
  isRecurring: boolean;
  billingPeriod: string | null;
  isActive: boolean;
  description: string | null;
};

export function ProductsTable({ data }: { data: ProductRow[] }) {
  const columns = useMemo<ColumnDef<ProductRow, unknown>[]>(
    () => [
      { accessorKey: "name", header: ({ column }) => <DataTableColumnHeader column={column} title="Název" />, meta: { label: "Název" }, cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      { accessorKey: "code", header: "Kód", meta: { label: "Kód" }, cell: ({ row }) => row.original.code ?? "—" },
      { accessorKey: "category", header: "Kategorie", meta: { label: "Kategorie" }, cell: ({ row }) => row.original.category ?? "—" },
      {
        accessorKey: "price",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Cena bez DPH" />,
        meta: { label: "Cena" },
        cell: ({ row }) => (
          <span>
            {formatCurrency(row.original.price)}
            {row.original.isRecurring && <span className="text-muted-foreground text-xs"> /{row.original.billingPeriod === "yearly" ? "rok" : "měs."}</span>}
          </span>
        ),
      },
      { accessorKey: "vatRate", header: "DPH", meta: { label: "DPH" }, cell: ({ row }) => `${row.original.vatRate}%` },
      {
        accessorKey: "isActive",
        header: "Stav",
        meta: { label: "Stav" },
        cell: ({ row }) => (row.original.isActive ? <StatusBadge label="Aktivní" color="emerald" /> : <StatusBadge label="Neaktivní" color="slate" />),
        filterFn: (row, id, value) => value === "all" || String(row.getValue(id)) === value,
      },
      {
        id: "actions",
        header: "",
        meta: { label: "Akce" },
        cell: ({ row }) => (
          <ProductFormDialog
            product={{ id: row.original.id, name: row.original.name, code: row.original.code, category: row.original.category, description: row.original.description, unit: row.original.unit, price: row.original.price, vatRate: row.original.vatRate, isRecurring: row.original.isRecurring, billingPeriod: row.original.billingPeriod, isActive: row.original.isActive }}
            trigger={<ProductEditTrigger />}
          />
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Hledat produkty…"
      exportFilename="produkty"
      emptyMessage="Zatím žádné produkty."
      facets={[{ columnId: "isActive", title: "Stav", options: [{ value: "true", label: "Aktivní" }, { value: "false", label: "Neaktivní" }] }]}
      toolbarActions={<ProductFormDialog />}
    />
  );
}

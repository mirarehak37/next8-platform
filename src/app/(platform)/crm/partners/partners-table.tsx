"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { StatusBadge } from "@/components/status-badge";
import { PARTNER_KINDS, PARTNERSHIP_STATUSES, findMeta } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";

export type PartnerRow = {
  id: string;
  name: string;
  kind: string;
  level: string | null;
  clubName: string | null;
  contactName: string | null;
  status: string;
  contractEnd: string | null;
  contractAlert: string | null;
  contractAlertColor: string | null;
  theyGiveYearly: number;
  weGiveYearly: number;
  ownerName: string;
};

export function PartnersTable({ data, toolbarActions }: { data: PartnerRow[]; toolbarActions?: React.ReactNode }) {
  const columns = useMemo<ColumnDef<PartnerRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Název" />,
        meta: { label: "Název" },
        cell: ({ row }) => (
          <Link href={`/crm/partners/${row.original.id}`} className="font-medium hover:underline text-foreground">{row.original.name}</Link>
        ),
      },
      {
        accessorKey: "kind",
        header: "Typ",
        meta: { label: "Typ" },
        cell: ({ row }) => {
          const meta = findMeta(PARTNER_KINDS, row.original.kind);
          return meta ? <StatusBadge label={meta.label} color={meta.color} /> : row.original.kind;
        },
        filterFn: (row, id, value) => value === "all" || row.getValue(id) === value,
      },
      { accessorKey: "level", header: "Úroveň", meta: { label: "Úroveň" }, cell: ({ row }) => row.original.level ?? "—" },
      { accessorKey: "clubName", header: "Sponzorovaný klub", meta: { label: "Sponzorovaný klub" }, cell: ({ row }) => row.original.clubName ?? "—" },
      { accessorKey: "contactName", header: "Kontaktní osoba", meta: { label: "Kontaktní osoba" }, cell: ({ row }) => row.original.contactName ?? "—" },
      {
        accessorKey: "status",
        header: "Stav",
        meta: { label: "Stav" },
        cell: ({ row }) => {
          const meta = findMeta(PARTNERSHIP_STATUSES, row.original.status);
          return meta ? <StatusBadge label={meta.label} color={meta.color} /> : row.original.status;
        },
        filterFn: (row, id, value) => value === "all" || row.getValue(id) === value,
      },
      {
        accessorKey: "contractEnd",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Smlouva do" />,
        meta: { label: "Smlouva do" },
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <span>{formatDate(row.original.contractEnd)}</span>
            {row.original.contractAlert && <StatusBadge label={row.original.contractAlert} color={row.original.contractAlertColor ?? "amber"} />}
          </div>
        ),
      },
      {
        accessorKey: "theyGiveYearly",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Přínos / rok" />,
        meta: { label: "Přínos / rok" },
        cell: ({ row }) => (row.original.theyGiveYearly ? formatCurrency(row.original.theyGiveYearly) : "—"),
      },
      {
        accessorKey: "weGiveYearly",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Protiplnění / rok" />,
        meta: { label: "Protiplnění / rok" },
        cell: ({ row }) => (row.original.weGiveYearly ? formatCurrency(row.original.weGiveYearly) : "—"),
      },
      { accessorKey: "ownerName", header: "Vlastník", meta: { label: "Vlastník" } },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Hledat partnery…"
      exportFilename="partneri"
      emptyMessage="Zatím žádní partneři."
      facets={[
        { columnId: "kind", title: "Typ", options: PARTNER_KINDS.map((k) => ({ value: k.value, label: k.label })) },
        { columnId: "status", title: "Stav", options: PARTNERSHIP_STATUSES.map((s) => ({ value: s.value, label: s.label })) },
      ]}
      toolbarActions={toolbarActions}
    />
  );
}

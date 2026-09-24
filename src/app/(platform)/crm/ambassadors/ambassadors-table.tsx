"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AMBASSADOR_TIERS, PARTNERSHIP_STATUSES, findMeta } from "@/lib/constants";
import { formatCurrency, formatDate, initials } from "@/lib/format";

export type AmbassadorRow = {
  id: string;
  fullName: string;
  nickname: string | null;
  companyName: string | null;
  position: string | null;
  sport: string | null;
  instagram: string | null;
  followers: number | null;
  status: string;
  tier: string | null;
  contractEnd: string | null;
  contractAlert: string | null;
  contractAlertColor: string | null;
  yearlyCost: number;
  obligations: number;
  ownerName: string;
};

const numberFormat = new Intl.NumberFormat("cs-CZ");

export function AmbassadorsTable({ data, toolbarActions }: { data: AmbassadorRow[]; toolbarActions?: React.ReactNode }) {
  const columns = useMemo<ColumnDef<AmbassadorRow, unknown>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Jméno" />,
        meta: { label: "Jméno" },
        cell: ({ row }) => (
          <Link href={`/crm/ambassadors/${row.original.id}`} className="flex items-center gap-2 font-medium hover:underline text-foreground">
            <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{initials(row.original.fullName)}</AvatarFallback></Avatar>
            <span>
              {row.original.fullName}
              {row.original.nickname && <span className="text-muted-foreground font-normal"> „{row.original.nickname}“</span>}
            </span>
          </Link>
        ),
      },
      { accessorKey: "companyName", header: "Klub", meta: { label: "Klub" }, cell: ({ row }) => row.original.companyName ?? "—" },
      {
        accessorKey: "position",
        header: "Pozice",
        meta: { label: "Pozice" },
        cell: ({ row }) => [row.original.position, row.original.sport].filter(Boolean).join(" · ") || "—",
      },
      { accessorKey: "instagram", header: "Instagram", meta: { label: "Instagram" }, cell: ({ row }) => row.original.instagram ?? "—" },
      {
        accessorKey: "followers",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Sledující" />,
        meta: { label: "Sledující" },
        cell: ({ row }) => (row.original.followers != null ? numberFormat.format(row.original.followers) : "—"),
      },
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
        accessorKey: "tier",
        header: "Úroveň",
        meta: { label: "Úroveň" },
        cell: ({ row }) => {
          const meta = findMeta(AMBASSADOR_TIERS, row.original.tier);
          return meta ? <StatusBadge label={meta.label} color={meta.color} /> : "—";
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
        accessorKey: "yearlyCost",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Náklad / rok" />,
        meta: { label: "Náklad / rok" },
        cell: ({ row }) => (row.original.yearlyCost ? formatCurrency(row.original.yearlyCost) : "—"),
      },
      { accessorKey: "obligations", header: "Povinnosti", meta: { label: "Povinnosti" }, cell: ({ row }) => row.original.obligations || "—" },
      { accessorKey: "ownerName", header: "Vlastník", meta: { label: "Vlastník" } },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Hledat ambasadory…"
      exportFilename="ambasadori"
      emptyMessage="Zatím žádní ambasadoři."
      facets={[
        { columnId: "status", title: "Stav", options: PARTNERSHIP_STATUSES.map((s) => ({ value: s.value, label: s.label })) },
        { columnId: "tier", title: "Úroveň", options: AMBASSADOR_TIERS.map((s) => ({ value: s.value, label: s.label })) },
      ]}
      toolbarActions={toolbarActions}
    />
  );
}

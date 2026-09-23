"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CompanyFormDialog } from "@/components/crm/company-form-dialog";
import { COMPANY_STATUSES, findMeta } from "@/lib/constants";
import { formatCurrency, initials } from "@/lib/format";

export type CompanyRow = {
  id: string;
  name: string;
  industry: string | null;
  sport: string | null;
  league: string | null;
  segment: string | null;
  status: string;
  city: string | null;
  employeeCount: number | null;
  annualRevenue: number | null;
  ownerName: string;
  dealCount: number;
  createdAt: string;
};

export function CompaniesTable({ data, owners }: { data: CompanyRow[]; owners: { id: string; name: string }[] }) {
  // Built from the data itself, not a fixed enum — sport/league are creatable
  // combobox fields, so the filter should offer whatever clubs actually have set.
  const sportOptions = useMemo(
    () => Array.from(new Set(data.map((d) => d.sport).filter((v): v is string => !!v))).sort().map((v) => ({ value: v, label: v })),
    [data],
  );
  const leagueOptions = useMemo(
    () => Array.from(new Set(data.map((d) => d.league).filter((v): v is string => !!v))).sort().map((v) => ({ value: v, label: v })),
    [data],
  );

  const columns = useMemo<ColumnDef<CompanyRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Klub" />,
        meta: { label: "Klub" },
        cell: ({ row }) => (
          <Link href={`/crm/companies/${row.original.id}`} className="font-medium hover:underline text-foreground">
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "sport",
        header: "Sport",
        meta: { label: "Sport" },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.sport ?? "—"}</span>,
        filterFn: (row, id, value) => value === "all" || row.getValue(id) === value,
      },
      {
        accessorKey: "league",
        header: "Liga",
        meta: { label: "Liga" },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.league ?? "—"}</span>,
        filterFn: (row, id, value) => value === "all" || row.getValue(id) === value,
      },
      {
        accessorKey: "industry",
        header: "Obor",
        meta: { label: "Obor" },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.industry ?? "—"}</span>,
      },
      {
        accessorKey: "segment",
        header: "Segment",
        meta: { label: "Segment" },
      },
      {
        accessorKey: "status",
        header: "Stav",
        meta: { label: "Stav" },
        cell: ({ row }) => {
          const meta = findMeta(COMPANY_STATUSES, row.original.status);
          return <StatusBadge label={meta?.label ?? row.original.status} color={meta?.color} />;
        },
        filterFn: (row, id, value) => value === "all" || row.getValue(id) === value,
      },
      {
        accessorKey: "city",
        header: "Město",
        meta: { label: "Město" },
      },
      {
        accessorKey: "annualRevenue",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Roční obrat" />,
        meta: { label: "Roční obrat" },
        cell: ({ row }) => (row.original.annualRevenue ? formatCurrency(row.original.annualRevenue) : "—"),
      },
      {
        accessorKey: "dealCount",
        header: "Obchody",
        meta: { label: "Obchody" },
        cell: ({ row }) => <span className="tabular-nums">{row.original.dealCount}</span>,
      },
      {
        accessorKey: "ownerName",
        header: "Vlastník",
        meta: { label: "Vlastník" },
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px]">{initials(row.original.ownerName)}</AvatarFallback>
            </Avatar>
            <span className="text-sm">{row.original.ownerName}</span>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Hledat kluby podle názvu, sportu…"
      exportFilename="kluby"
      emptyMessage="Zatím žádné kluby. Vytvořte první záznam."
      facets={[
        { columnId: "status", title: "Stav", options: COMPANY_STATUSES.map((s) => ({ value: s.value, label: s.label })) },
        { columnId: "sport", title: "Sport", options: sportOptions },
        { columnId: "league", title: "Liga", options: leagueOptions },
      ]}
      toolbarActions={<CompanyFormDialog owners={owners} />}
    />
  );
}

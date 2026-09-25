"use client";

import { useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { StatusBadge } from "@/components/status-badge";
import { LeadFormDialog, LeadEditTrigger } from "@/components/crm/lead-form-dialog";
import { ConvertLeadDialog } from "@/components/crm/convert-lead-dialog";
import { LEAD_STATUSES, LEAD_RATINGS, findMeta } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";

export type LeadRow = {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  campaign: string | null;
  estimatedValue: number | null;
  status: string;
  rating: string | null;
  notes: string | null;
  ownerId: string;
  ownerName: string;
};

export function LeadsTable({
  data,
  owners,
  pipelineId,
  firstStageId,
  campaigns,
}: {
  data: LeadRow[];
  owners: { id: string; name: string }[];
  campaigns: { value: string; label: string; hint?: string }[];
  pipelineId: string;
  firstStageId: string;
}) {
  const columns = useMemo<ColumnDef<LeadRow, unknown>[]>(
    () => [
      { accessorKey: "name", header: ({ column }) => <DataTableColumnHeader column={column} title="Jméno" />, meta: { label: "Jméno" }, cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      { accessorKey: "companyName", header: "Klub", meta: { label: "Klub" }, cell: ({ row }) => row.original.companyName ?? "—" },
      { accessorKey: "email", header: "E-mail", meta: { label: "E-mail" }, cell: ({ row }) => row.original.email ?? "—" },
      { accessorKey: "source", header: "Zdroj", meta: { label: "Zdroj" }, cell: ({ row }) => row.original.source ?? "—" },
      {
        accessorKey: "estimatedValue",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Odhad. hodnota" />,
        meta: { label: "Hodnota" },
        cell: ({ row }) => (row.original.estimatedValue ? formatCurrency(row.original.estimatedValue) : "—"),
      },
      {
        accessorKey: "rating",
        header: "Hodnocení",
        meta: { label: "Hodnocení" },
        cell: ({ row }) => {
          const meta = findMeta(LEAD_RATINGS, row.original.rating);
          return meta ? <StatusBadge label={meta.label} color={meta.color} /> : "—";
        },
      },
      {
        accessorKey: "status",
        header: "Stav",
        meta: { label: "Stav" },
        cell: ({ row }) => {
          const meta = findMeta(LEAD_STATUSES, row.original.status);
          return <StatusBadge label={meta?.label ?? row.original.status} color={meta?.color} />;
        },
        filterFn: (row, id, value) => value === "all" || row.getValue(id) === value,
      },
      { accessorKey: "ownerName", header: "Vlastník", meta: { label: "Vlastník" } },
      {
        id: "actions",
        header: "",
        meta: { label: "Akce" },
        cell: ({ row }) => (
          <div className="flex items-center gap-1 justify-end">
            {row.original.status !== "converted" && (
              <ConvertLeadDialog leadId={row.original.id} leadLabel={row.original.name} pipelineId={pipelineId} firstStageId={firstStageId} />
            )}
            <LeadFormDialog
              owners={owners}
              campaigns={campaigns}
              lead={{
                id: row.original.id,
                firstName: row.original.firstName,
                lastName: row.original.lastName,
                companyName: row.original.companyName,
                jobTitle: row.original.jobTitle,
                email: row.original.email,
                phone: row.original.phone,
                source: row.original.source,
                campaign: row.original.campaign,
                estimatedValue: row.original.estimatedValue,
                ownerId: row.original.ownerId,
                status: row.original.status,
                rating: row.original.rating,
                notes: row.original.notes,
              }}
              trigger={<LeadEditTrigger />}
            />
          </div>
        ),
      },
    ],
    [owners, pipelineId, firstStageId, campaigns],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Hledat leady…"
      exportFilename="leady"
      emptyMessage="Zatím žádné leady."
      facets={[{ columnId: "status", title: "Stav", options: LEAD_STATUSES.map((s) => ({ value: s.value, label: s.label })) }]}
      toolbarActions={<LeadFormDialog owners={owners} campaigns={campaigns} />}
    />
  );
}

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ContactFormDialog } from "@/components/crm/contact-form-dialog";
import { CONTACT_STATUSES, findMeta } from "@/lib/constants";
import { initials } from "@/lib/format";

export type ContactRow = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  ownerName: string;
};

export function ContactsTable({
  data,
  owners,
  companies,
}: {
  data: ContactRow[];
  owners: { id: string; name: string }[];
  companies: { id: string; name: string }[];
}) {
  const columns = useMemo<ColumnDef<ContactRow, unknown>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Jméno" />,
        meta: { label: "Jméno" },
        cell: ({ row }) => (
          <Link href={`/crm/contacts/${row.original.id}`} className="flex items-center gap-2 font-medium hover:underline text-foreground">
            <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{initials(row.original.fullName)}</AvatarFallback></Avatar>
            {row.original.fullName}
          </Link>
        ),
      },
      { accessorKey: "jobTitle", header: "Pozice", meta: { label: "Pozice" }, cell: ({ row }) => row.original.jobTitle ?? "—" },
      { accessorKey: "companyName", header: "Klub", meta: { label: "Klub" }, cell: ({ row }) => row.original.companyName ?? "—" },
      { accessorKey: "email", header: "E-mail", meta: { label: "E-mail" }, cell: ({ row }) => row.original.email ?? "—" },
      { accessorKey: "phone", header: "Telefon", meta: { label: "Telefon" }, cell: ({ row }) => row.original.phone ?? "—" },
      {
        accessorKey: "status",
        header: "Stav",
        meta: { label: "Stav" },
        cell: ({ row }) => {
          const meta = findMeta(CONTACT_STATUSES, row.original.status);
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
      searchPlaceholder="Hledat kontakty podle jména, e-mailu…"
      exportFilename="kontakty"
      emptyMessage="Zatím žádné kontakty."
      facets={[{ columnId: "status", title: "Stav", options: CONTACT_STATUSES.map((s) => ({ value: s.value, label: s.label })) }]}
      toolbarActions={<ContactFormDialog owners={owners} companies={companies} />}
    />
  );
}

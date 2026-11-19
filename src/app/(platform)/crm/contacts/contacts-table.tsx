"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { StatusBadge } from "@/components/status-badge";
import { Tag } from "@/components/common/tag";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ContactFormDialog } from "@/components/crm/contact-form-dialog";
import { CONTACT_STATUSES, findMeta } from "@/lib/constants";
import { initials } from "@/lib/format";

export type ContactRow = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  companyName: string | null;
  teamNames: string[];
  email: string | null;
  phone: string | null;
  status: string;
  ownerName: string;
  marketingConsent: "yes" | "no";
  tags: string[];
};

const CONSENT_OPTIONS = [
  { value: "yes", label: "Smí obchodní sdělení" },
  { value: "no", label: "Jen servisní" },
];

export function ContactsTable({
  data,
  owners,
  companies,
}: {
  data: ContactRow[];
  owners: { id: string; name: string }[];
  companies: { id: string; name: string }[];
}) {
  const teamOptions = useMemo(
    () => Array.from(new Set(data.flatMap((d) => d.teamNames))).sort().map((v) => ({ value: v, label: v })),
    [data],
  );
  const tagOptions = useMemo(
    () => Array.from(new Set(data.flatMap((d) => d.tags))).sort((a, b) => a.localeCompare(b, "cs")).map((v) => ({ value: v, label: v })),
    [data],
  );

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
      {
        accessorKey: "teamNames",
        header: "Tým",
        meta: { label: "Tým" },
        cell: ({ row }) => (row.original.teamNames.length > 0 ? row.original.teamNames.join(", ") : "—"),
        filterFn: (row, id, value) => value === "all" || (row.getValue(id) as string[]).includes(value),
      },
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
      {
        accessorKey: "tags",
        header: "Tagy",
        meta: { label: "Tagy" },
        cell: ({ row }) =>
          row.original.tags.length > 0 ? (
            <span className="flex max-w-[320px] flex-wrap gap-1">
              {row.original.tags.slice(0, 4).map((t) => (
                <Tag key={t} size="sm">{t}</Tag>
              ))}
              {row.original.tags.length > 4 && (
                <span className="caption-style self-center text-subtle" title={row.original.tags.slice(4).join(", ")}>
                  +{row.original.tags.length - 4}
                </span>
              )}
            </span>
          ) : (
            "—"
          ),
        filterFn: (row, id, value) => value === "all" || (row.getValue(id) as string[]).includes(value),
        enableSorting: false,
      },
      {
        accessorKey: "marketingConsent",
        header: "Obchodní sdělení",
        meta: { label: "Obchodní sdělení" },
        cell: ({ row }) =>
          row.original.marketingConsent === "yes" ? (
            <Tag tone="green" size="sm">Smí</Tag>
          ) : (
            <span className="text-subtle">Ne</span>
          ),
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
      facets={[
        { columnId: "status", title: "Stav", options: CONTACT_STATUSES.map((s) => ({ value: s.value, label: s.label })) },
        { columnId: "teamNames", title: "Tým", options: teamOptions },
        { columnId: "tags", title: "Tag", options: tagOptions },
        { columnId: "marketingConsent", title: "Obchodní sdělení", options: CONSENT_OPTIONS },
      ]}
      toolbarActions={<ContactFormDialog owners={owners} companies={companies} />}
    />
  );
}

"use client";

import * as React from "react";
import {
  ColumnDef, ColumnFiltersState, SortingState, VisibilityState,
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { exportToCsv } from "@/lib/export-csv";

export type Facet = { columnId: string; title: string; options: { value: string; label: string }[] };

export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder = "Hledat…",
  facets = [],
  toolbarActions,
  exportFilename = "export",
  emptyMessage = "Žádné záznamy",
}: {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  searchPlaceholder?: string;
  facets?: Facet[];
  toolbarActions?: React.ReactNode;
  exportFilename?: string;
  emptyMessage?: string;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: "includesString",
    initialState: { pagination: { pageSize: 15 } },
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder={searchPlaceholder}
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs h-9"
        />
        {facets.map((facet) => {
          const column = table.getColumn(facet.columnId);
          if (!column) return null;
          const value = (column.getFilterValue() as string) ?? "all";
          return (
            <Select
              key={facet.columnId}
              items={{ all: `${facet.title}: vše`, ...Object.fromEntries(facet.options.map((o) => [o.value, o.label])) }}
              value={value}
              onValueChange={(v) => column.setFilterValue(v === "all" ? undefined : v)}
            >
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue placeholder={facet.title} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{facet.title}: vše</SelectItem>
                {facet.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          {toolbarActions}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="h-9">
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Sloupce
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              {table
                .getAllColumns()
                .filter((c) => c.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(v) => column.toggleVisibility(!!v)}
                  >
                    {(column.columnDef.meta as { label?: string } | undefined)?.label ?? column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() =>
              exportToCsv(
                exportFilename,
                table.getFilteredRowModel().rows.map((r) => r.original as Record<string, unknown>),
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          {table.getFilteredRowModel().rows.length} záznamů · stránka {table.getState().pagination.pageIndex + 1} z{" "}
          {table.getPageCount() || 1}
        </div>
        <div className="flex items-center gap-3">
          <Select
            items={{ "15": "15 / str.", "50": "50 / str.", "100": "100 / str.", "999999": "Zobrazit vše" }}
            value={String(Math.min(table.getState().pagination.pageSize, 999999))}
            onValueChange={(v) => table.setPageSize(Number(v))}
          >
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 / str.</SelectItem>
              <SelectItem value="50">50 / str.</SelectItem>
              <SelectItem value="100">100 / str.</SelectItem>
              <SelectItem value="999999">Zobrazit vše</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

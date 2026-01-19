"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@repo/ui/components/ui/context-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { cn } from "@repo/ui/lib/utils";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

type ColumnMeta = {
  headerClassName?: string;
  cellClassName?: string;
};

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
  onRowHover?: (row: TData) => void;
  getRowClassName?: (row: TData) => string;
  renderRowContextMenu?: (row: TData) => React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
  onRowHover,
  getRowClassName,
  renderRowContextMenu,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return (
    <div className="overflow-visible">
      <Table className="table-fixed min-w-[760px] border-spacing-0">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta as ColumnMeta | undefined;
                return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "sticky top-0 z-10 h-8 bg-background px-2 text-xs",
                      meta?.headerClassName,
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => {
              const contextMenu = renderRowContextMenu?.(row.original);
              const hasContextMenu = contextMenu !== null && contextMenu !== undefined;
              const rowCells = row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
                const content = flexRender(cell.column.columnDef.cell, cell.getContext());
                const cellClassName = cn(
                  hasContextMenu ? "p-0 text-xs" : "px-2 py-1.5 text-xs",
                  meta?.cellClassName,
                );
                return (
                  <TableCell key={cell.id} className={cellClassName}>
                    {hasContextMenu ? (
                      <ContextMenuTrigger className="block w-full px-2 py-1.5">
                        {content}
                      </ContextMenuTrigger>
                    ) : (
                      content
                    )}
                  </TableCell>
                );
              });

              const rowElement = (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn("group", getRowClassName?.(row.original))}
                  style={
                    {
                      contentVisibility: "auto",
                      containIntrinsicSize: "32px 0px",
                    } as React.CSSProperties
                  }
                  onClick={
                    onRowClick
                      ? () => {
                          onRowClick(row.original);
                        }
                      : undefined
                  }
                  onMouseEnter={
                    onRowHover
                      ? () => {
                          onRowHover(row.original);
                        }
                      : undefined
                  }
                >
                  {rowCells}
                </TableRow>
              );

              if (!hasContextMenu) {
                return rowElement;
              }

              return (
                <ContextMenu key={row.id}>
                  {rowElement}
                  <ContextMenuContent>{contextMenu}</ContextMenuContent>
                </ContextMenu>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-sm">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

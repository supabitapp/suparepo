"use client";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import type { Column, ColumnDef } from "@tanstack/react-table";
import { compressionErrorLabel, compressionErrorMessage } from "@/compression";
import { formatBytes } from "@/lib/format";
import { convertFormatExtension, getWorkflow, type Workflow } from "@/lib/workflows";
import type { FileItem } from "@/store";

function SortableHeader({
  column,
  title,
  className,
}: {
  column: Column<FileItem, unknown>;
  title: string;
  className?: string;
}) {
  const isSorted = column.getIsSorted();

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className={cn("h-7 w-full justify-start px-1 text-xs", className)}
      onClick={() => column.toggleSorting(isSorted === "asc")}
    >
      <span>{title}</span>
      {isSorted ? (
        <span className="ml-1 text-[10px] text-muted-foreground">
          {isSorted === "asc" ? "^" : "v"}
        </span>
      ) : null}
    </Button>
  );
}

function StatusCell({ file }: { file: FileItem }) {
  const progressLabel =
    file.status === "processing" && file.progress !== undefined
      ? `${Math.round(Math.min(1, Math.max(0, file.progress)) * 100)}%`
      : "";
  const errorLabel = file.status === "error" ? compressionErrorLabel(file.error) : "";
  const errorMessage = file.status === "error" ? compressionErrorMessage(file.error) : undefined;
  const processingLabel = getWorkflow(file.workflow).processingLabel;
  const statusLabel =
    file.status === "done"
      ? "Done"
      : file.status === "processing"
        ? progressLabel || processingLabel
        : file.status === "skipped"
          ? "Skipped"
          : file.status === "error"
            ? errorLabel
            : "Pending";
  const statusClass =
    file.status === "done"
      ? "text-green-600"
      : file.status === "skipped"
        ? "text-muted-foreground"
        : file.status === "error"
          ? "text-red-500"
          : "text-muted-foreground";
  const labelTitle =
    file.status === "error"
      ? errorMessage?.trim() || errorLabel
      : file.status === "skipped"
        ? file.skipReason?.trim() || "Skipped"
        : undefined;

  return (
    <span className={cn("truncate font-medium", statusClass)} title={labelTitle}>
      {statusLabel}
    </span>
  );
}

const columns: ColumnDef<FileItem>[] = [
  {
    accessorKey: "status",
    header: ({ column }) => <SortableHeader column={column} title="Status" />,
    cell: ({ row }) => <StatusCell file={row.original} />,
    meta: {
      headerClassName: "w-[120px]",
      cellClassName: "w-[120px]",
    },
  },
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} title="Name" />,
    cell: ({ row }) => (
      <span className="block w-full truncate text-sm text-foreground">{row.original.name}</span>
    ),
    meta: {
      cellClassName: "max-w-0",
    },
  },
  {
    accessorFn: (row) => (row.originalSize > 0 ? row.originalSize : undefined),
    id: "originalSize",
    header: ({ column }) => (
      <SortableHeader column={column} title="Before" className="justify-end" />
    ),
    cell: ({ row }) => {
      const value = row.original.originalSize;
      return (
        <span className="block text-right tabular-nums">
          {value > 0 ? formatBytes(value) : "-"}
        </span>
      );
    },
    sortUndefined: "last",
    meta: {
      headerClassName: "w-[130px] text-right",
      cellClassName: "text-right",
    },
  },
  {
    accessorFn: (row) => row.outputSize,
    id: "outputSize",
    header: ({ column }) => (
      <SortableHeader column={column} title="After" className="justify-end" />
    ),
    cell: ({ row }) => {
      const value = row.original.outputSize;
      return (
        <span className="block text-right tabular-nums">
          {value !== undefined ? formatBytes(value) : "-"}
        </span>
      );
    },
    sortUndefined: "last",
    meta: {
      headerClassName: "w-[150px] text-right",
      cellClassName: "text-right",
    },
  },
  {
    accessorFn: (row) =>
      row.outputSize !== undefined && row.originalSize > 0
        ? ((row.originalSize - row.outputSize) / row.originalSize) * 100
        : undefined,
    id: "savingsPercent",
    header: ({ column }) => <SortableHeader column={column} title="%" className="justify-end" />,
    cell: ({ row }) => {
      if (row.original.outputSize === undefined || row.original.originalSize <= 0) {
        return <span className="text-muted-foreground">-</span>;
      }
      const savings =
        ((row.original.originalSize - row.original.outputSize) / row.original.originalSize) * 100;
      const label = `${savings >= 0 ? "-" : "+"}${Math.abs(savings).toFixed(1)}%`;
      return (
        <span className={cn("tabular-nums", savings >= 0 ? "text-green-600" : "text-red-500")}>
          {label}
        </span>
      );
    },
    sortUndefined: "last",
    meta: {
      headerClassName: "w-[120px] text-right",
      cellClassName: "text-right",
    },
  },
];

const fileExtension = (path: string) => {
  const ext = path.split(".").pop();
  return ext ? ext.toUpperCase() : "-";
};

const columnsConvert: ColumnDef<FileItem>[] = [
  columns[0],
  columns[1],
  {
    accessorFn: (row) => fileExtension(row.path),
    id: "inputType",
    header: ({ column }) => (
      <SortableHeader column={column} title="Before" className="justify-end" />
    ),
    cell: ({ row }) => (
      <span className="block text-right tabular-nums">{fileExtension(row.original.path)}</span>
    ),
    meta: {
      headerClassName: "w-[120px] text-right",
      cellClassName: "text-right",
    },
  },
  {
    accessorFn: (row) =>
      row.outputFormat ? convertFormatExtension(row.outputFormat).toUpperCase() : undefined,
    id: "outputType",
    header: ({ column }) => (
      <SortableHeader column={column} title="After" className="justify-end" />
    ),
    cell: ({ row }) => (
      <span className="block text-right tabular-nums">
        {row.original.outputFormat
          ? convertFormatExtension(row.original.outputFormat).toUpperCase()
          : "-"}
      </span>
    ),
    sortUndefined: "last",
    meta: {
      headerClassName: "w-[120px] text-right",
      cellClassName: "text-right",
    },
  },
];

const metricsColumnIds = new Set(["originalSize", "outputSize", "savingsPercent"]);

const blurTextHiddenColumnIds = new Set(["originalSize", "outputSize"]);

export const columnsForWorkflow = (workflow: Workflow) => {
  if (workflow === "convert") {
    return columnsConvert;
  }
  if (workflow === "blur_text") {
    return columns.filter((column) => {
      const id =
        column.id ??
        ("accessorKey" in column && typeof column.accessorKey === "string"
          ? column.accessorKey
          : undefined);
      return !blurTextHiddenColumnIds.has(id ?? "");
    });
  }
  if (workflow !== "remove_bg") {
    return columns;
  }
  return columns.filter((column) => {
    const id =
      column.id ??
      ("accessorKey" in column && typeof column.accessorKey === "string"
        ? column.accessorKey
        : undefined);
    return !metricsColumnIds.has(id ?? "");
  });
};

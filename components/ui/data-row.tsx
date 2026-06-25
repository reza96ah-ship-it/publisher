import React from "react";
import { cn } from "@/lib/utils";

export interface DataRowProps extends React.HTMLAttributes<HTMLDivElement> {
  selectable?: boolean;
  selected?: boolean;
  gridClassName?: string;
  children: React.ReactNode;
}

export function DataRow({
  selectable = false,
  selected = false,
  gridClassName,
  className,
  children,
  ...props
}: DataRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-3 py-3 rounded-md border transition-colors sm:px-4 lg:grid lg:items-start lg:gap-3",
        gridClassName,
        selectable && "cursor-pointer",
        selected
          ? "bg-app-soft border-app-primary"
          : "border-app-border/50 hover:bg-app-soft/50",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface DataTableProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: string[];
  gridClassName?: string;
  empty?: React.ReactNode;
  children: React.ReactNode;
}

export function DataTable({
  columns,
  gridClassName,
  empty,
  className,
  children,
  ...props
}: DataTableProps) {
  return (
    <div
      className={cn("space-y-1 mt-3 sm:mt-4", className)}
      {...props}
    >
      {columns && gridClassName && (
        <div className={cn(
          "sticky top-0 z-10 hidden gap-3 border-b border-app-border bg-app-surfaceMuted px-3 py-2.5 text-[10px] font-black uppercase text-app-muted lg:grid",
          gridClassName
        )}>
          {columns.map((column) => <span key={column}>{column}</span>)}
        </div>
      )}
      {empty ? empty : null}
      <div className="divide-y divide-app-border">{children}</div>
    </div>
  );
}



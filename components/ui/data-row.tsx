import React from "react";
import { cn } from "@/lib/utils";

export interface DataRowProps extends React.HTMLAttributes<HTMLDivElement> {
  selectable?: boolean;
  selected?: boolean;
  children: React.ReactNode;
}

export function DataRow({
  selectable = false,
  selected = false,
  className,
  children,
  ...props
}: DataRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-md border transition-colors",
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
  children: React.ReactNode;
}

export function DataTable({ className, children, ...props }: DataTableProps) {
  return (
    <div
      className={cn("space-y-1", className)}
      {...props}
    >
      {children}
    </div>
  );
}


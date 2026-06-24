import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MetricTileProps {
  label: string;
  value: string | number;
  change?: {
    value: number;
    direction: "up" | "down" | "neutral";
    label?: string;
  };
  icon?: LucideIcon;
  variant?: "glass" | "solid";
  className?: string;
  onClick?: () => void;
}

export function MetricTile({
  label,
  value,
  change,
  icon: Icon,
  variant = "glass",
  className,
  onClick,
}: MetricTileProps) {
  const changeColor = {
    up: "text-emerald-600",
    down: "text-rose-600",
    neutral: "text-slate-600",
  }[change?.direction || "neutral"];

  const baseClass = variant === "glass"
    ? "bg-white/30 backdrop-blur-xl border border-white/20"
    : "bg-white border border-app-border";
  const interactiveProps = onClick
    ? {
        onClick,
        onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
          }
        },
        role: "button",
        tabIndex: 0
      }
    : {};

  return (
    <div
      className={cn(
        "rounded-lg p-4 transition-all hover:shadow-md",
        baseClass,
        onClick && "cursor-pointer hover:scale-105",
        className
      )}
      {...interactiveProps}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-app-muted mb-1">{label}</p>
          <p className="text-2xl font-black text-app-text">{value}</p>
          {change && (
            <p className={cn("text-xs font-bold mt-1.5", changeColor)}>
              {change.direction === "up" ? "↑" : change.direction === "down" ? "↓" : "→"} {Math.abs(change.value)}
              {change.label && ` ${change.label}`}
            </p>
          )}
        </div>
        {Icon && (
          <div className="flex-shrink-0 h-10 w-10 rounded-md bg-app-soft text-app-primary flex items-center justify-center">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  );
}


import React from "react";
import { cn } from "@/lib/utils";

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "glass" | "solid" | "muted";
  children: React.ReactNode;
}

export function Panel({
  variant = "glass",
  className,
  children,
  ...props
}: PanelProps) {
  const variantClasses = {
    glass: "bg-white/30 backdrop-blur-xl border border-white/20",
    solid: "bg-white border border-app-border",
    muted: "bg-app-surface border border-app-border/50",
  };

  return (
    <div
      className={cn(
        "rounded-lg p-4 transition-all",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}


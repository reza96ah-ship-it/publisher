import React from "react";
import { cn } from "@/lib/utils";

export interface StatusTokenProps
  extends React.HTMLAttributes<HTMLDivElement> {
  status?: "success" | "warning" | "alert" | "info" | "neutral";
  size?: "sm" | "md" | "lg";
}

const StatusToken = React.forwardRef<HTMLDivElement, StatusTokenProps>(
  ({ className, status = "info", size = "md", children, ...props }, ref) => {
    const statusStyles = {
      success: "bg-emerald-100 text-emerald-700",
      warning: "bg-amber-100 text-amber-700",
      alert: "bg-rose-100 text-rose-700",
      info: "bg-blue-100 text-blue-700",
      neutral: "bg-slate-100 text-slate-700",
    };

    const sizeStyles = {
      sm: "h-6 w-6 text-xs",
      md: "h-8 w-8 text-sm",
      lg: "h-10 w-10 text-base",
    };

    return (
      <div
        className={cn(
          "inline-flex items-center justify-center rounded-full font-bold shrink-0",
          statusStyles[status],
          sizeStyles[size],
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    );
  }
);
StatusToken.displayName = "StatusToken";

export { StatusToken };

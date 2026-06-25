import type { ReactNode } from "react";

type TagTone = "neutral" | "primary" | "success" | "warning" | "alert" | "info";

type TagProps = {
  tone?: TagTone;
  children: ReactNode;
  className?: string;
};

const toneClasses: Record<TagTone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  primary: "bg-violet-50 text-violet-700 ring-violet-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  alert: "bg-rose-50 text-rose-700 ring-rose-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200"
};

export function Tag({ tone = "neutral", children, className = "" }: TagProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${toneClasses[tone]} ${className}`}>
      {children}
    </span>
  );
}

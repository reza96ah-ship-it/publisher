import { formatPostCountdown } from "../lib/countdown";

const toneClasses = {
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  warning: "bg-amber-50 text-amber-700 ring-amber-100",
  danger: "bg-rose-50 text-rose-700 ring-rose-100"
};

type CountdownBadgeProps = {
  status: string;
  scheduledAt?: string | null;
  className?: string;
};

export function CountdownBadge({ status, scheduledAt, className = "" }: CountdownBadgeProps) {
  const countdown = formatPostCountdown(status, scheduledAt);
  if (!countdown) return null;

  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-semibold leading-none ring-1 ${toneClasses[countdown.tone]} ${className}`}>
      {countdown.label}
    </span>
  );
}


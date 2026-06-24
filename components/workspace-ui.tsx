import { Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type WorkspacePageProps = {
  children: ReactNode;
  className?: string;
};

type WorkspaceHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

type WorkspaceHeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
};

type WorkspaceToolbarProps = {
  children: ReactNode;
  meta?: ReactNode;
  className?: string;
};

type MetricTileProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "neutral" | "primary" | "success" | "warning" | "alert" | "info";
  icon?: ReactNode;
};

type InspectorPanelProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

type WorkspacePanelProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

type NoticeTone = "success" | "warning" | "alert" | "info";

type NoticeBannerProps = {
  tone?: NoticeTone;
  title?: string;
  children: ReactNode;
};

type DetailGridItem = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
};

type SegmentedControlProps<T extends string> = {
  options: Array<{ label: string; value: T; count?: number }>;
  value: T;
  onChange: (value: T) => void;
};

type StatusTokenTone = "neutral" | "primary" | "success" | "warning" | "alert" | "info" | "dark";

type StatusTokenProps = {
  tone?: StatusTokenTone;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  className?: string;
};

type StatusRailStep = {
  label: string;
  description?: string;
  meta?: ReactNode;
  href?: string;
  icon?: ReactNode;
  state: "done" | "active" | "pending";
};

type TimelineItem = {
  title: string;
  description?: string;
  meta?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "primary" | "success" | "warning" | "alert" | "info";
};

const metricToneClasses: Record<NonNullable<MetricTileProps["tone"]>, string> = {
  neutral: "text-slate-700",
  primary: "text-app-primary",
  success: "text-emerald-700",
  warning: "text-amber-700",
  alert: "text-rose-700",
  info: "text-sky-700"
};

const tokenToneClasses: Record<StatusTokenTone, string> = {
  neutral: "border-slate-200 bg-slate-50/90 text-slate-700",
  primary: "border-blue-200 bg-blue-50 text-app-primary",
  success: "border-teal-200 bg-teal-50 text-teal-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  alert: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  dark: "border-blue-500 bg-app-primary text-white"
};

const tokenSizeClasses: Record<NonNullable<StatusTokenProps["size"]>, string> = {
  sm: "min-h-6 px-2.5 py-1 text-[11px]",
  md: "min-h-7 px-3 py-1 text-xs",
  lg: "min-h-8 px-3.5 py-1.5 text-xs"
};

const noticeToneClasses: Record<NoticeTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  alert: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-blue-200 bg-blue-50 text-blue-800"
};

export function WorkspacePage({ children, className = "" }: WorkspacePageProps) {
  return <div className={`mx-auto w-full max-w-[1560px] space-y-3 sm:space-y-4 ${className}`}>{children}</div>;
}

export function WorkspaceHero({ eyebrow, title, description, actions, meta, aside }: WorkspaceHeroProps) {
  return (
    <section className="nahrino-card overflow-hidden rounded-xl">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 px-3 py-3 sm:px-4 lg:px-5">
          {eyebrow ? <p className="app-section-kicker text-[11px] font-black uppercase">{eyebrow}</p> : null}
          <div className="mt-2 flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
            <div className="min-w-0">
              <h1 className="text-xl font-black text-app-text sm:text-2xl">{title}</h1>
              {description ? <p className="mt-1.5 line-clamp-3 max-w-3xl text-xs leading-5 text-app-muted sm:text-sm sm:leading-6">{description}</p> : null}
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
          </div>
          {meta ? <div className="mt-3 flex flex-wrap gap-2">{meta}</div> : null}
        </div>
        {aside ? <div className="nahrino-card-muted border-t border-app-border p-3 sm:p-4 lg:border-r lg:border-t-0">{aside}</div> : null}
      </div>
    </section>
  );
}

export function WorkspaceHeader({ eyebrow, title, description, action }: WorkspaceHeaderProps) {
  return (
    <header className="flex flex-col justify-between gap-3 border-b border-app-border pb-4 lg:flex-row lg:items-end">
      <div className="min-w-0">
        {eyebrow ? <p className="app-section-kicker text-[11px] font-black uppercase">{eyebrow}</p> : null}
        <h1 className="mt-1 text-xl font-black text-app-text sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-3xl text-xs leading-5 text-app-muted sm:text-sm sm:leading-6">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function WorkspaceToolbar({ children, meta, className = "" }: WorkspaceToolbarProps) {
  return (
    <div className={`app-row nahrino-card-muted flex flex-col gap-2 rounded-lg px-2.5 py-2 lg:flex-row lg:items-center lg:justify-between ${className}`}>
      <div className="min-w-0">{children}</div>
      {meta ? <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-app-muted">{meta}</div> : null}
    </div>
  );
}

export function MetricTile({ label, value, hint, tone = "neutral", icon }: MetricTileProps) {
  return (
    <div className="app-row min-w-0 bg-white p-2.5 sm:p-3">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div>
          <p className="line-clamp-1 text-[10px] font-bold text-app-muted sm:text-xs">{label}</p>
          <p className={`mt-1 text-lg font-black sm:text-xl ${metricToneClasses[tone]}`}>{value}</p>
        </div>
        {icon ? <div className="hidden rounded-md bg-app-surfaceMuted p-2 text-slate-600 sm:block">{icon}</div> : null}
      </div>
      {hint ? <p className="mt-1.5 line-clamp-2 text-[11px] leading-5 text-app-muted">{hint}</p> : null}
    </div>
  );
}

export function MetricStrip({ children }: { children: ReactNode }) {
  return <div className="nahrino-card grid grid-cols-2 overflow-hidden rounded-lg divide-x divide-y divide-app-border divide-x-reverse md:grid-cols-4 md:divide-y-0">{children}</div>;
}

export function WorkspacePanel({ title, description, action, children, className = "", bodyClassName = "p-4" }: WorkspacePanelProps) {
  return (
    <section className={`nahrino-card rounded-xl ${className}`}>
      <div className="flex flex-col justify-between gap-2 border-b border-app-border bg-[#fbfaf7] px-3 py-2.5 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <h2 className="text-sm font-black text-app-text">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-5 text-app-muted">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="app-enter flex flex-col items-center justify-center rounded-md border border-dashed border-app-borderStrong bg-[#faf9f5] px-3 py-5 text-center sm:px-4 sm:py-6">
      {icon ? <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md border border-teal-100 bg-white text-app-teal shadow-soft">{icon}</div> : null}
      <p className="text-sm font-black text-app-text">{title}</p>
      {description ? <p className="mt-1.5 max-w-md text-xs leading-5 text-app-muted sm:text-sm sm:leading-6">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function NoticeBanner({ tone = "info", title, children }: NoticeBannerProps) {
  return (
    <div className={`app-popover rounded-md border px-3 py-2.5 text-xs leading-5 sm:text-sm sm:leading-6 ${noticeToneClasses[tone]}`}>
      {title ? <p className="font-black">{title}</p> : null}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}

export function DetailGrid({ items }: { items: DetailGridItem[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-md bg-app-surfaceMuted/85 p-2.5 shadow-hairline">
          <p className="text-[11px] font-black text-app-muted">{item.label}</p>
          <div className="mt-1 text-sm font-black text-app-text">{item.value}</div>
          {item.hint ? <div className="mt-1 text-xs leading-5 text-app-muted">{item.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function InspectorPanel({ title, description, children, footer }: InspectorPanelProps) {
  return (
    <aside className="app-studio-panel rounded-lg shadow-lift">
      <div className="border-b border-app-border bg-app-canvas/70 px-3 py-2.5">
        <h2 className="text-sm font-black text-app-text">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-5 text-app-muted">{description}</p> : null}
      </div>
      <div className="p-3 sm:p-4">{children}</div>
      {footer ? <div className="border-t border-app-border bg-slate-50 p-3">{footer}</div> : null}
    </aside>
  );
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex rounded-md bg-app-surfaceMuted p-1 shadow-hairline">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`app-interactive inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-bold ${
              active ? "bg-white text-app-primary shadow-sm ring-1 ring-blue-200" : "text-slate-600 hover:text-app-primary"
            }`}
          >
            {option.label}
            {typeof option.count === "number" ? (
              <span className={`rounded px-1.5 py-0.5 ${active ? "bg-blue-50 text-blue-700" : "bg-white text-slate-500"}`}>
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function StatusToken({ tone = "neutral", size = "sm", children, className = "" }: StatusTokenProps) {
  return (
    <span className={`inline-flex items-center justify-center rounded-md border font-black leading-none transition-colors duration-200 ${tokenSizeClasses[size]} ${tokenToneClasses[tone]} ${className}`}>
      {children}
    </span>
  );
}

const railDotClasses: Record<StatusRailStep["state"], string> = {
  done: "border-emerald-500 bg-emerald-500 text-white",
  active: "app-dot-pulse border-emerald-500 bg-emerald-500 text-white",
  pending: "border-slate-300 bg-white text-slate-400"
};

export function StatusRail({ steps }: { steps: StatusRailStep[] }) {
  return (
    <ol className="app-studio-surface grid overflow-hidden rounded-lg md:grid-cols-2 xl:grid-cols-4">
      {steps.map((step, index) => {
        const content = (
          <>
            <div className="flex items-center">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${railDotClasses[step.state]}`}>
                {step.state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              {index < steps.length - 1 ? <span className={`mx-2 h-px flex-1 border-t border-dashed ${step.state === "done" ? "border-emerald-300" : "border-slate-300"}`} /> : null}
            </div>
            <div className="mt-2.5 flex items-start gap-2">
              {step.icon ? <span className={step.state === "pending" ? "text-slate-400" : "text-app-primary"}>{step.icon}</span> : null}
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-app-text">{step.label}</p>
                {step.description ? <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-app-muted">{step.description}</p> : null}
                {step.meta ? <div className="mt-1 text-[10px] font-bold text-slate-400">{step.meta}</div> : null}
              </div>
            </div>
          </>
        );

        return (
          <li key={`${step.label}-${index}`} className="border-b border-app-border p-3.5 md:border-l md:last:border-l-0 xl:border-b-0">
            {step.href ? <Link href={step.href} className="app-interactive block">{content}</Link> : content}
          </li>
        );
      })}
    </ol>
  );
}

const timelineDotClasses: Record<NonNullable<TimelineItem["tone"]>, string> = {
  neutral: "border-slate-300 bg-white text-slate-500",
  primary: "border-blue-500 bg-blue-50 text-app-primary",
  success: "border-emerald-500 bg-emerald-50 text-emerald-700",
  warning: "border-amber-500 bg-amber-50 text-amber-700",
  alert: "border-rose-500 bg-rose-50 text-rose-700",
  info: "border-sky-500 bg-sky-50 text-sky-700"
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol>
      {items.map((item, index) => (
        <li key={`${item.title}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
          {index < items.length - 1 ? <span className="absolute right-[13px] top-7 h-[calc(100%-1rem)] border-r border-dashed border-slate-300" /> : null}
          <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${timelineDotClasses[item.tone ?? "neutral"]}`}>
            {item.icon ?? <span className="h-1.5 w-1.5 rounded-full bg-current" />}
          </span>
          <div className="min-w-0 pt-1">
            <p className="text-xs font-black text-app-text">{item.title}</p>
            {item.description ? <p className="mt-1 text-xs leading-5 text-app-muted">{item.description}</p> : null}
            {item.meta ? <div className="mt-1 text-[11px] text-slate-400">{item.meta}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

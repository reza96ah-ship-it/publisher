"use client";

import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";
import { useMemo, useState } from "react";
import { X, type LucideIcon } from "lucide-react";

type Tone = "neutral" | "primary" | "success" | "warning" | "alert" | "info";
type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
type ButtonSize = "sm" | "md" | "lg";
type FieldState = "default" | "success" | "error";
type SurfaceVariant = "plain" | "muted" | "raised" | "tonal";
type SurfacePadding = "none" | "sm" | "md" | "lg";

type NPageProps = {
  children: ReactNode;
  className?: string;
};

type NPageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
};

type NButtonSharedProps = {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  trailingIcon?: LucideIcon;
  loading?: boolean;
};

type NButtonAsButtonProps = NButtonSharedProps & ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: never;
};

type NButtonAsLinkProps = NButtonSharedProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  disabled?: boolean;
};

type NButtonProps = NButtonAsButtonProps | NButtonAsLinkProps;

type NIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: LucideIcon;
  variant?: ButtonVariant;
  size?: ButtonSize;
  badge?: ReactNode;
};

type NStatusPillProps = {
  children: ReactNode;
  tone?: Tone;
  className?: string;
};

type NTagProps = {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  onRemove?: () => void;
};

type NFieldProps = {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
};

type NInputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon?: LucideIcon;
  state?: FieldState;
  trailing?: ReactNode;
};

type NTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  state?: FieldState;
};

type NSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  state?: FieldState;
};

type NSurfaceProps = {
  children: ReactNode;
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
  className?: string;
};

type NRowProps = {
  title: string;
  detail?: string;
  icon?: LucideIcon;
  tone?: Tone;
  href?: string;
  meta?: ReactNode;
  action?: ReactNode;
  selected?: boolean;
  className?: string;
};

type NTabOption = {
  label: string;
  value: string;
  count?: number;
  href?: string;
};

type NTabsProps = {
  tabs: NTabOption[];
  activeTab: string;
  onTabChange?: (value: string) => void;
  className?: string;
};

type NSavedViewOption = {
  label: string;
  value: string;
  count?: number;
};

type NSavedViewToolbarProps = {
  views: NSavedViewOption[];
  activeView: string;
  onViewChange?: (value: string) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

type NChannelRailProps = {
  channels: Array<{
    label: string;
    color: string;
    state?: string;
    muted?: boolean;
  }>;
  compact?: boolean;
  className?: string;
};

type NInspectorDrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  side?: "left" | "right";
};

type NSectionProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

type NActionTileProps = {
  label: string;
  value: ReactNode;
  detail?: string;
  icon: LucideIcon;
  tone?: Tone;
  href?: string;
  compact?: boolean;
};

type NMetricTileProps = {
  label: string;
  value: ReactNode;
  detail?: string;
  icon?: LucideIcon;
  tone?: Tone;
  href?: string;
};

type NListItemProps = {
  title: string;
  detail?: string;
  icon: LucideIcon;
  tone?: Tone;
  href?: string;
  meta?: ReactNode;
};

type NEmptyStateProps = {
  title: string;
  detail?: string;
  icon: LucideIcon;
};

type NDonutChartProps = {
  items: Array<{ label: string; value: number; color: string }>;
  total: number;
  label?: string;
};

type NTrendBarsProps = {
  values: number[];
  labels?: string[];
};

type NNoticeProps = {
  children: ReactNode;
  title?: string;
  tone?: Exclude<Tone, "neutral" | "primary">;
};

const toneSurfaceClasses: Record<Tone, string> = {
  neutral: "border-app-border bg-app-surfaceMuted text-app-muted",
  primary: "border-app-primary/20 bg-app-soft text-app-primary",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  alert: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-app-secondary/20 bg-app-secondarySoft text-app-secondary"
};

const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary: "nahrino-primary-cta",
  secondary: "border-app-border bg-app-surface text-app-text shadow-hairline hover:bg-app-surfaceMuted",
  quiet: "border-transparent bg-transparent text-app-muted hover:bg-app-surface hover:text-app-text",
  danger: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
};

const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-10 px-3.5 text-sm",
  lg: "min-h-11 px-4 text-sm"
};

const iconButtonSizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12"
};

const surfaceVariantClasses: Record<SurfaceVariant, string> = {
  plain: "border-app-border bg-app-surface shadow-hairline",
  muted: "border-app-border bg-app-surfaceMuted shadow-hairline",
  raised: "border-app-border bg-app-surface shadow-soft",
  tonal: "border-app-primary/20 bg-app-soft shadow-hairline"
};

const surfacePaddingClasses: Record<SurfacePadding, string> = {
  none: "",
  sm: "p-2.5",
  md: "p-3 sm:p-4",
  lg: "p-4 sm:p-5"
};

const fieldStateClasses: Record<FieldState, string> = {
  default: "border-app-border focus-within:border-app-focus focus-within:ring-app-focus/20",
  success: "border-emerald-200 focus-within:border-emerald-500 focus-within:ring-emerald-100",
  error: "border-rose-200 focus-within:border-rose-500 focus-within:ring-rose-100"
};

const toneAccentTokens: Record<Tone, string> = {
  neutral: "var(--n-color-muted)",
  primary: "var(--n-color-primary)",
  success: "var(--n-color-success)",
  warning: "var(--n-color-warning)",
  alert: "var(--n-color-alert)",
  info: "var(--n-color-info)"
};

function toneVars(tone: Tone): CSSProperties {
  return {
    "--metric-accent": toneAccentTokens[tone],
    "--token-accent": toneAccentTokens[tone]
  } as CSSProperties;
}

export function NPage({ children, className = "" }: NPageProps) {
  return <div className={`mx-auto w-full max-w-[1360px] space-y-3 sm:space-y-4 ${className}`}>{children}</div>;
}

export function NPageHeader({ title, description, eyebrow, meta, action, className = "" }: NPageHeaderProps) {
  return (
    <section className={`nahrino-card rounded-lg px-3 py-3 sm:px-4 ${className}`}>
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0">
          {eyebrow ? <p className="app-section-kicker text-[10px] font-black">{eyebrow}</p> : null}
          <h1 className="mt-1 text-xl font-black leading-8 text-app-text sm:text-2xl">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-xs leading-5 text-app-muted sm:text-sm sm:leading-6">{description}</p> : null}
        </div>
        {(meta || action) ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {meta}
            {action}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function NButton(props: NButtonProps) {
  const { children, className = "", variant = "primary", size = "md", icon: Icon, trailingIcon: TrailingIcon, loading = false } = props;
  const classes = [
    "app-interactive nahrino-control-radius inline-flex items-center justify-center gap-2 whitespace-nowrap border font-bold leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus/30 disabled:pointer-events-none disabled:opacity-60",
    buttonVariantClasses[variant],
    buttonSizeClasses[size],
    className
  ].join(" ");
  const content = (
    <>
      {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" /> : Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      <span>{children}</span>
      {TrailingIcon ? <TrailingIcon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
    </>
  );

  if ("href" in props && props.href) {
    const {
      href,
      disabled,
      children: _children,
      className: _className,
      variant: _variant,
      size: _size,
      icon: _icon,
      trailingIcon: _trailingIcon,
      loading: _loading,
      ...linkProps
    } = props;
    return (
      <Link href={href} className={classes} aria-disabled={disabled || linkProps["aria-disabled"]} tabIndex={disabled ? -1 : linkProps.tabIndex} {...linkProps}>
        {content}
      </Link>
    );
  }

  const {
    children: _children,
    className: _className,
    variant: _variant,
    size: _size,
    icon: _icon,
    trailingIcon: _trailingIcon,
    loading: _loading,
    type,
    disabled,
    ...buttonProps
  } = props as NButtonAsButtonProps;
  return (
    <button type={type ?? "button"} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...buttonProps}>
      {content}
    </button>
  );
}

export function NIconButton({ label, icon: Icon, variant = "secondary", size = "md", badge, className = "", type, ...props }: NIconButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={`app-interactive nahrino-control-radius relative inline-flex items-center justify-center border font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus/30 disabled:pointer-events-none disabled:opacity-60 ${buttonVariantClasses[variant]} ${iconButtonSizeClasses[size]} ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {badge ? <span className="absolute -left-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white">{badge}</span> : null}
    </button>
  );
}

export function NStatusPill({ children, tone = "neutral", className = "" }: NStatusPillProps) {
  return (
    <span className={`inline-flex min-h-6 items-center justify-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black ${toneSurfaceClasses[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function NTag({ children, tone = "neutral", className = "", onRemove }: NTagProps) {
  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-black ${toneSurfaceClasses[tone]} ${className}`}>
      {children}
      {onRemove ? (
        <button type="button" onClick={onRemove} className="app-interactive -ml-1 inline-flex h-5 w-5 items-center justify-center rounded text-current hover:bg-white/70" aria-label="حذف برچسب">
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}

export function NSurface({ children, variant = "plain", padding = "md", className = "" }: NSurfaceProps) {
  return <section className={`rounded-lg border ${surfaceVariantClasses[variant]} ${surfacePaddingClasses[padding]} ${className}`}>{children}</section>;
}

export function NField({ label, children, hint, error, required = false, className = "" }: NFieldProps) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 flex items-center gap-1 text-xs font-black text-app-text">
        {label}
        {required ? <span className="text-rose-600" aria-hidden="true">*</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1.5 block text-[11px] font-bold text-rose-700">{error}</span> : hint ? <span className="mt-1.5 block text-[11px] leading-5 text-app-muted">{hint}</span> : null}
    </label>
  );
}

export function NInput({ icon: Icon, state = "default", trailing, className = "", ...props }: NInputProps) {
  return (
    <span className={`flex min-h-standard items-center gap-2 rounded-md border bg-app-surface px-3 shadow-hairline ring-2 ring-transparent transition ${fieldStateClasses[state]} ${className}`}>
      {Icon ? <Icon className="h-4 w-4 shrink-0 text-app-muted" aria-hidden="true" /> : null}
      <input className="min-w-0 flex-1 bg-transparent text-sm font-medium text-app-text outline-none placeholder:text-app-muted/70 disabled:cursor-not-allowed disabled:opacity-60" {...props} />
      {trailing ? <span className="shrink-0 text-xs font-bold text-app-muted">{trailing}</span> : null}
    </span>
  );
}

export function NTextarea({ state = "default", className = "", ...props }: NTextareaProps) {
  return (
    <span className={`block rounded-md border bg-app-surface px-3 py-2 shadow-hairline ring-2 ring-transparent transition ${fieldStateClasses[state]} ${className}`}>
      <textarea className="min-h-28 w-full resize-y bg-transparent text-sm font-medium leading-7 text-app-text outline-none placeholder:text-app-muted/70 disabled:cursor-not-allowed disabled:opacity-60" {...props} />
    </span>
  );
}

export function NSelect({ state = "default", className = "", children, ...props }: NSelectProps) {
  return (
    <span className={`block rounded-md border bg-app-surface px-3 shadow-hairline ring-2 ring-transparent transition ${fieldStateClasses[state]} ${className}`}>
      <select className="min-h-standard w-full bg-transparent text-sm font-bold text-app-text outline-none disabled:cursor-not-allowed disabled:opacity-60" {...props}>
        {children}
      </select>
    </span>
  );
}

export function NSavedViewToolbar({
  views,
  activeView,
  onViewChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = "جست‌وجو...",
  filters,
  meta,
  className = ""
}: NSavedViewToolbarProps) {
  return (
    <section className={`nahrino-card-muted rounded-lg p-2.5 ${className}`}>
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {views.map((view) => {
            const active = activeView === view.value;
            return (
              <button
                key={view.value}
                type="button"
                onClick={() => onViewChange?.(view.value)}
                className={`app-interactive inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-black ${
                  active ? "bg-white text-app-primary shadow-hairline" : "text-app-muted hover:bg-white/80 hover:text-app-text"
                }`}
                aria-pressed={active}
              >
                {view.label}
                {typeof view.count === "number" ? <span className="rounded bg-app-surfaceMuted px-1.5 py-0.5 text-[10px] text-app-muted">{view.count}</span> : null}
              </button>
            );
          })}
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          {typeof searchValue === "string" ? (
            <label className="flex min-h-9 min-w-0 items-center rounded-md border border-app-border bg-white px-3 shadow-hairline sm:w-64">
              <span className="sr-only">{searchPlaceholder}</span>
              <input
                value={searchValue}
                onChange={(event) => onSearchChange?.(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </label>
          ) : null}
          {filters}
          {meta ? <div className="flex flex-wrap items-center gap-1.5">{meta}</div> : null}
        </div>
      </div>
    </section>
  );
}

export function NTabs({ tabs, activeTab, onTabChange, className = "" }: NTabsProps) {
  return (
    <div className={`inline-flex min-h-10 max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-app-border bg-app-surfaceMuted p-1 shadow-hairline ${className}`} role="tablist">
      {tabs.map((tab) => {
        const active = tab.value === activeTab;
        const tabClassName = `app-interactive inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus/30 ${
          active ? "bg-app-surface text-app-primary shadow-hairline" : "text-app-muted hover:bg-app-surface hover:text-app-text"
        }`;
        const content = (
          <>
            <span>{tab.label}</span>
            {typeof tab.count === "number" ? <span className="rounded bg-app-surfaceMuted px-1.5 py-0.5 text-[10px] text-app-muted">{tab.count}</span> : null}
          </>
        );

        if (tab.href) {
          return (
            <Link key={tab.value} href={tab.href} className={tabClassName} role="tab" aria-selected={active}>
              {content}
            </Link>
          );
        }

        return (
          <button key={tab.value} type="button" onClick={() => onTabChange?.(tab.value)} className={tabClassName} role="tab" aria-selected={active}>
            {content}
          </button>
        );
      })}
    </div>
  );
}

export function NRow({ title, detail, icon: Icon, tone = "primary", href, meta, action, selected = false, className = "" }: NRowProps) {
  const content = (
    <article
      className={`group relative grid min-h-[64px] gap-3 rounded-2xl border px-4 py-3 transition-all sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
        selected ? "border-app-primary bg-app-primary/5 shadow-sm" : "border-slate-200/60 bg-white/60 hover:bg-white hover:shadow-sm"
      } ${className}`}
      style={toneVars(tone)}
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[rgb(var(--token-accent)_/_0.05)] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative flex min-w-0 items-center gap-3.5">
        {Icon ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--token-accent)_/_0.1)] text-[rgb(var(--token-accent))] ring-1 ring-[rgb(var(--token-accent)_/_0.15)] transition-transform group-hover:scale-110">
            <Icon className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
          </span>
        ) : null}
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-black text-slate-900 transition-colors group-hover:text-[rgb(var(--token-accent))]">{title}</span>
          {detail ? <span className="mt-0.5 block truncate text-[12px] font-medium text-slate-500">{detail}</span> : null}
        </span>
      </div>
      {(meta || action) ? (
        <div className="relative flex min-w-0 items-center gap-3 sm:justify-end">
          {meta ? <span className="min-w-0 truncate text-[12px] font-bold text-slate-400">{meta}</span> : null}
          {action}
        </div>
      ) : null}
    </article>
  );

  return href ? <Link href={href} className="block rounded-2xl focus:outline-none focus:ring-2 focus:ring-[rgb(var(--token-accent)_/_0.5)]">{content}</Link> : content;
}

export function NChannelRail({ channels, compact = false, className = "" }: NChannelRailProps) {
  if (!channels.length) return null;

  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-1.5 ${className}`} aria-label="کانال‌ها">
      {channels.map((channel) => (
        <span
          key={`${channel.label}-${channel.state ?? "state"}`}
          className={`inline-flex items-center gap-1.5 rounded-md border border-app-border bg-white font-black shadow-hairline ${
            compact ? "min-h-6 px-1.5 text-[10px]" : "min-h-8 px-2 text-xs"
          } ${channel.muted ? "text-app-muted" : "text-app-text"}`}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: channel.color }} />
          <span className="truncate">{channel.label}</span>
          {channel.state ? <span className="text-app-muted">· {channel.state}</span> : null}
        </span>
      ))}
    </div>
  );
}

export function NNotice({ children, title, tone = "info" }: NNoticeProps) {
  return (
    <div className={`rounded-md border px-3 py-2.5 text-xs leading-5 sm:text-sm sm:leading-6 ${toneSurfaceClasses[tone]}`}>
      {title ? <p className="font-black">{title}</p> : null}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}

export function NInspectorDrawer({ open, title, description, children, footer, onClose, side = "left" }: NInspectorDrawerProps) {
  if (!open) return null;

  const sideClass = side === "left" ? "left-0" : "right-0";

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-900/20 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="min-w-0 flex-1 cursor-default" onClick={onClose} aria-label="بستن بازرس" />
      <aside className={`app-popover absolute bottom-0 top-0 ${sideClass} flex w-full max-w-md flex-col overflow-hidden border-app-border bg-white shadow-lift sm:w-[420px] ${side === "left" ? "border-r" : "border-l"}`}>
        <header className="border-b border-app-border px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-black text-app-text">{title}</h2>
              {description ? <p className="mt-1 text-xs leading-5 text-app-muted">{description}</p> : null}
            </div>
            <button type="button" onClick={onClose} className="app-interactive flex h-8 w-8 items-center justify-center rounded-md text-app-muted hover:bg-app-surfaceMuted hover:text-app-text" aria-label="بستن">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? <footer className="border-t border-app-border bg-app-surfaceMuted p-3">{footer}</footer> : null}
      </aside>
    </div>
  );
}

export function NSection({ title, description, action, children, className = "", bodyClassName = "mt-5" }: NSectionProps) {
  return (
    <section className={`rounded-[24px] border border-white/20 bg-white/60 p-5 shadow-sm ring-1 ring-black/5 backdrop-blur-2xl transition-all ${className}`}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <h2 className="text-[17px] font-black tracking-tight text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-[13px] leading-6 text-slate-500">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function NActionTile({ label, value, detail, icon: Icon, tone = "primary", href, compact = true }: NActionTileProps) {
  const content = (
    <article className={`${compact ? "min-h-[88px] p-4" : "min-h-[140px] p-5"} group relative overflow-hidden rounded-[20px] border border-white/40 bg-white/80 shadow-sm ring-1 ring-black/5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-white`} style={toneVars(tone)}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative flex h-full flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">{label}</p>
            <p className={`mt-1 font-black tracking-tight text-slate-900 ${compact ? "line-clamp-1 text-[17px]" : "line-clamp-2 text-xl"}`}>{value}</p>
          </div>
          <span className={`flex ${compact ? "h-10 w-10" : "h-12 w-12"} shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[rgb(var(--token-accent)_/_0.15)] to-[rgb(var(--token-accent)_/_0.05)] text-[rgb(var(--token-accent))] shadow-sm ring-1 ring-[rgb(var(--token-accent)_/_0.2)] transition-transform group-hover:scale-110`}>
            <Icon className={`${compact ? "h-5 w-5" : "h-6 w-6"}`} aria-hidden="true" strokeWidth={2.5} />
          </span>
        </div>
        {detail ? <p className={`${compact ? "hidden sm:line-clamp-2 sm:block" : "line-clamp-2"} text-[12px] font-medium leading-5 text-slate-500`}>{detail}</p> : null}
      </div>
    </article>
  );

  return href ? <Link href={href} className="block rounded-[20px] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--token-accent))]">{content}</Link> : content;
}

export function NMetricTile({ label, value, detail, icon: Icon, tone = "primary", href }: NMetricTileProps) {
  const content = (
    <article className="group relative min-h-[100px] overflow-hidden rounded-[20px] border border-white/40 bg-white/80 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-white" style={toneVars(tone)}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative flex h-full items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-1 text-[11px] font-bold tracking-wider text-slate-500 uppercase">{label}</p>
          <p className="mt-1.5 text-2xl font-black tracking-tight text-slate-900">{value}</p>
          {detail ? <p className="mt-2 hidden truncate text-[12px] font-medium text-slate-500 sm:block">{detail}</p> : null}
        </div>
        {Icon ? (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[rgb(var(--token-accent)_/_0.15)] to-[rgb(var(--token-accent)_/_0.05)] text-[rgb(var(--token-accent))] shadow-sm ring-1 ring-[rgb(var(--token-accent)_/_0.2)] transition-transform group-hover:scale-110 sm:flex">
            <Icon className="h-6 w-6" aria-hidden="true" strokeWidth={2.5} />
          </span>
        ) : null}
      </div>
    </article>
  );

  return href ? <Link href={href} className="block rounded-[20px] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--token-accent))]">{content}</Link> : content;
}

export function NListItem({ title, detail, icon: Icon, tone = "primary", href, meta }: NListItemProps) {
  const content = (
    <article className="group flex min-h-[64px] items-center gap-3 rounded-2xl border border-slate-200/50 bg-slate-50/50 px-3 py-2 transition-all hover:bg-white hover:shadow-sm" style={toneVars(tone)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--token-accent)_/_0.1)] text-[rgb(var(--token-accent))] ring-1 ring-[rgb(var(--token-accent)_/_0.15)] transition-transform group-hover:scale-110">
        <Icon className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-black text-slate-900 transition-colors group-hover:text-[rgb(var(--token-accent))]">{title}</span>
        {detail ? <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-500">{detail}</span> : null}
      </span>
      {meta ? <span className="max-w-[96px] shrink-0 truncate text-[11px] font-bold text-slate-400">{meta}</span> : null}
    </article>
  );

  return href ? <Link href={href} className="block rounded-2xl focus:outline-none focus:ring-2 focus:ring-[rgb(var(--token-accent)_/_0.5)]">{content}</Link> : content;
}

export function NEmptyState({ title, detail, icon: Icon }: NEmptyStateProps) {
  return (
    <div className="flex min-h-[80px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200/50 text-slate-400">
        <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={2.5} />
      </span>
      <div className="max-w-[280px]">
        <h3 className="text-[14px] font-black tracking-tight text-slate-700">{title}</h3>
        {detail ? <p className="mt-1 text-[12px] font-medium leading-5 text-slate-500">{detail}</p> : null}
      </div>
    </div>
  );
}

export function NDonutChart({ items, total, label = "کل" }: NDonutChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeItem = activeIndex === null ? null : items[activeIndex];
  const visibleItems = useMemo(() => items.filter((item) => item.value > 0), [items]);
  const background = useMemo(() => {
    let cursor = 0;
    return total
      ? visibleItems
        .map((item) => {
          const start = cursor;
          const size = (item.value / total) * 360;
          cursor += size;
          return `${item.color} ${start}deg ${cursor}deg`;
        })
        .join(", ")
      : "rgb(var(--n-chart-empty, var(--n-color-border))) 0deg 360deg";
  }, [total, visibleItems]);

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="nahrino-donut-chart relative h-32 w-32 rounded-full shadow-hairline sm:h-40 sm:w-40" style={{ background: `conic-gradient(${background})` } as CSSProperties}>
        <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-app-surface shadow-inner sm:inset-5">
          <span className="text-xl font-black text-app-text sm:text-2xl">{activeItem?.value ?? total}</span>
          <span className="mt-1 max-w-20 truncate text-[10px] font-bold text-app-muted">{activeItem?.label ?? label}</span>
        </div>
      </div>
      <div className="grid w-full grid-cols-1 gap-1.5 text-[10px] sm:gap-2 sm:text-xs">
        {items.map((item, index) => (
          <button
            key={item.label}
            type="button"
            className={`nahrino-chart-legend-row grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-app-surfaceMuted px-2 py-1.5 text-right sm:px-2.5 sm:py-2 ${activeIndex === index ? "nahrino-chart-legend-active" : ""}`}
            onBlur={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex(index)}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <span className="flex min-w-0 items-center gap-1.5 font-bold text-app-muted">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white" style={{ backgroundColor: item.color, opacity: item.value ? 1 : 0.48 }} />
              <span className="min-w-0 truncate">{item.label}</span>
            </span>
            <span className="min-w-5 shrink-0 text-left font-black tabular-nums text-app-text">{item.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function NTrendBars({ values, labels }: NTrendBarsProps) {
  const max = Math.max(...values, 1);

  return (
    <div className="flex h-28 items-end gap-1.5 rounded-lg bg-app-surfaceMuted px-3 py-3">
      {values.map((value, index) => (
        <div key={index} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span
            className="nahrino-trend-bar w-full rounded-t-md transition-all"
            style={{ height: `${Math.max(10, (value / max) * 88)}px` }}
            aria-label={`${value} items`}
          />
          <span className="text-[9px] font-bold text-slate-400">{labels?.[index] || index + 1}</span>
        </div>
      ))}
    </div>
  );
}

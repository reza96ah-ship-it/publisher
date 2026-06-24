"use client";

import { ImageIcon } from "lucide-react";
import type { ReactNode } from "react";
import { channelOptions, normalizeChannels } from "../lib/channels";
import { ChannelBadges } from "./channel-badges";
import { StatusToken } from "./workspace-ui";

type ContentOperationCardProps = {
  action?: ReactNode;
  approval?: ReactNode;
  campaignColor?: string;
  campaignLabel?: string;
  caption?: string;
  checked?: boolean;
  children?: ReactNode;
  error?: string | null;
  lifecycle?: ReactNode;
  mediaLabel?: string;
  meta?: ReactNode;
  onCheckedChange?: () => void;
  onSelect?: () => void;
  platform?: string | null;
  previewAlt?: string;
  previewUrl?: string;
  selected?: boolean;
  title: string;
};

export function ChannelRail({ platform }: { platform?: string | null }) {
  const channels = normalizeChannels(platform);

  return (
    <div className="flex shrink-0 flex-col overflow-hidden rounded-r-lg bg-slate-100 shadow-hairline" aria-label="کانال‌های محتوا">
      {channels.map((channel) => {
        const option = channelOptions.find((item) => item.value === channel) ?? channelOptions[0];
        const Icon = option.icon;
        return (
          <div key={channel} className={`flex min-h-12 w-8 items-center justify-center ${option.tone === "success" ? "bg-teal-500 text-white" : option.tone === "primary" ? "bg-blue-600 text-white" : "bg-slate-600 text-white"}`} title={option.label}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        );
      })}
    </div>
  );
}

export function ContentOperationCard({
  action,
  approval,
  campaignColor = "#CBD5E1",
  campaignLabel,
  caption,
  checked,
  children,
  error,
  lifecycle,
  mediaLabel,
  meta,
  onCheckedChange,
  onSelect,
  platform,
  previewAlt,
  previewUrl,
  selected,
  title
}: ContentOperationCardProps) {
  return (
    <article
      className={`app-row group relative grid overflow-hidden rounded-lg border bg-white text-right shadow-hairline transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-soft lg:grid-cols-[8px_minmax(0,1fr)_160px] ${
        selected ? "border-blue-300 bg-blue-50/35 ring-1 ring-blue-100" : "border-app-border"
      }`}
    >
      <span className="hidden h-full w-2 lg:block" style={{ backgroundColor: campaignColor }} aria-hidden="true" />
      <div className="grid min-w-0 gap-0 sm:grid-cols-[8px_minmax(0,1fr)] lg:grid-cols-1">
        <span className="block h-full w-2 sm:block lg:hidden" style={{ backgroundColor: campaignColor }} aria-hidden="true" />
        <button type="button" onClick={onSelect} className="min-w-0 p-3 text-right sm:p-3.5">
          <div className="flex min-w-0 gap-3">
            <ChannelRail platform={platform} />
            <div className="flex h-24 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-50 ring-1 ring-app-border">
              {previewUrl ? (
                <img src={previewUrl} alt={previewAlt || title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
              ) : (
                <ImageIcon className="h-6 w-6 text-slate-400" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {campaignLabel ? (
                  <StatusToken tone="neutral">
                    <span className="ml-1 inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: campaignColor }} />
                    {campaignLabel}
                  </StatusToken>
                ) : null}
                <ChannelBadges platform={platform} compact />
                {mediaLabel ? <StatusToken tone={previewUrl ? "success" : "warning"}>{mediaLabel}</StatusToken> : null}
              </div>
              <h2 className="truncate text-base font-black text-app-text">{title}</h2>
              {caption ? <p className="mt-2 line-clamp-2 text-sm leading-7 text-app-muted">{caption}</p> : null}
              {error ? <p className="mt-2 line-clamp-2 rounded bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">{error}</p> : null}
              {children ? <div className="mt-3">{children}</div> : null}
            </div>
          </div>
        </button>
      </div>

      <div className="border-t border-app-border bg-app-surfaceMuted/70 p-3 lg:border-r lg:border-t-0">
        <div className="flex flex-wrap items-center gap-2 lg:block lg:space-y-2">
          {lifecycle}
          {approval}
        </div>
        {meta ? <div className="mt-3 space-y-1.5 text-xs leading-5 text-app-muted">{meta}</div> : null}
        <div className="mt-3 flex flex-wrap items-center gap-2 lg:justify-between">
          {onCheckedChange ? (
            <label className="inline-flex items-center gap-2 text-[11px] font-bold text-app-muted">
              <input
                type="checkbox"
                checked={checked}
                onChange={onCheckedChange}
                className="h-4 w-4 rounded border-app-border accent-blue-600"
              />
              گروهی
            </label>
          ) : <span />}
          {action}
        </div>
      </div>
    </article>
  );
}

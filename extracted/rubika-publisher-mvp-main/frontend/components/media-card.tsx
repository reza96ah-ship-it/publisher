import { Tag } from "./ui/tag";
import type { ReactNode as Node } from "react";

type MediaCardProps = {
  filename: string;
  contentType: string;
  sizeLabel: string;
  previewUrl?: string;
  linkedLabel?: string;
  action?: Node;
};

export function MediaCard({ filename, contentType, sizeLabel, previewUrl, linkedLabel = "بدون اتصال", action }: MediaCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-app-border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      {previewUrl ? (
        <img src={previewUrl} alt={filename} className="aspect-video w-full object-cover" />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-slate-50 text-xs text-app-muted">
          پیش‌نمایش در دسترس نیست
        </div>
      )}
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-bold text-app-text" title={filename}>{filename}</p>
            <p className="mt-1 text-xs text-app-muted">{contentType} · {sizeLabel}</p>
          </div>
          <Tag tone={linkedLabel === "بدون اتصال" ? "neutral" : "primary"}>{linkedLabel}</Tag>
        </div>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </article>
  );
}

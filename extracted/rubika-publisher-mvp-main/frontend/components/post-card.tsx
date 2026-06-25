import { StatusBadge } from "./status-badge";

type PostCardProps = {
  title: string;
  caption: string;
  status: string;
  publishTime: string;
  attempts: string;
};

export function PostCard({ title, caption, status, publishTime, attempts }: PostCardProps) {
  return (
    <article className="rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-app-text">{title}</h3>
          <p className="mt-1 text-xs text-app-muted">روبیکا · {publishTime}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <p className="line-clamp-2 text-sm leading-7 text-slate-600">{caption}</p>
      <div className="mt-4 flex items-center justify-between border-t border-app-border pt-3 text-xs text-app-muted">
        <span>تلاش انتشار: {attempts}</span>
        <span>مشاهده جزئیات</span>
      </div>
    </article>
  );
}

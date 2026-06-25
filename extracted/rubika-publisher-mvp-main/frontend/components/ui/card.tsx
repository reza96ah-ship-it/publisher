import type { ReactNode } from "react";

type SectionCardProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SectionCard({ title, description, action, children, className = "" }: SectionCardProps) {
  return (
    <section className={`rounded-2xl border border-app-border bg-app-surface p-5 shadow-soft ${className}`}>
      {title || description || action ? (
        <div className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div>
            {title ? <h2 className="text-lg font-bold text-app-text">{title}</h2> : null}
            {description ? <p className="mt-2 text-sm leading-7 text-app-muted">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function SurfaceCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-app-border bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

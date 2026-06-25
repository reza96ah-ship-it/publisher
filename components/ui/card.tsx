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
    <section className={`app-studio-panel rounded-lg p-4 ${className}`}>
      {title || description || action ? (
        <div className="mb-4 flex flex-col justify-between gap-3 border-b border-app-border pb-3 lg:flex-row lg:items-start">
          <div>
            {title ? <h2 className="text-sm font-black text-app-text">{title}</h2> : null}
            {description ? <p className="mt-1 text-xs leading-5 text-app-muted">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function SurfaceCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`app-studio-surface rounded-lg p-4 ${className}`}>{children}</div>;
}


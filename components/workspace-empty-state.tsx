type WorkspaceEmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
};

export function WorkspaceEmptyState({ title, description, actionLabel, actionHref }: WorkspaceEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-app-border bg-app-surface p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-blue-50 ring-1 ring-blue-100" />
      <h2 className="text-lg font-bold text-app-text">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-app-muted">{description}</p>
      {actionLabel && actionHref ? (
        <a
          href={actionHref}
          className="mt-5 inline-flex rounded-xl bg-app-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-app-primaryHover"
        >
          {actionLabel}
        </a>
      ) : null}
    </div>
  );
}


import Link from "next/link";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
};

export function PageHeader({ eyebrow, title, description, actionLabel, actionHref }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
      <div>
        {eyebrow ? <p className="text-sm font-medium text-app-primary">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-app-text">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-7 text-app-muted">{description}</p> : null}
      </div>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="inline-flex w-full items-center justify-center rounded-xl bg-app-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-app-primaryHover lg:w-auto"
        >
          {actionLabel}
        </Link>
      ) : actionLabel ? (
        <button className="w-full rounded-xl bg-app-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-app-primaryHover lg:w-auto">
          {actionLabel}
        </button>
      ) : null}
    </header>
  );
}

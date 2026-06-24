import Link from "next/link";
import { WorkspaceHeader } from "./workspace-ui";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
};

export function PageHeader({ eyebrow, title, description, actionLabel, actionHref }: PageHeaderProps) {
  const action = actionLabel && actionHref ? (
    <Link
      href={actionHref}
      className="inline-flex w-full items-center justify-center rounded-md border border-app-primary bg-app-primary px-4 py-2.5 text-sm font-bold text-white transition hover:border-app-primaryHover hover:bg-app-primaryHover lg:w-auto"
    >
      {actionLabel}
    </Link>
  ) : actionLabel ? (
    <button className="w-full rounded-md border border-app-primary bg-app-primary px-4 py-2.5 text-sm font-bold text-white transition hover:border-app-primaryHover hover:bg-app-primaryHover lg:w-auto">
      {actionLabel}
    </button>
  ) : null;

  return (
    <div className="mb-5">
      <WorkspaceHeader eyebrow={eyebrow} title={title} description={description} action={action} />
    </div>
  );
}

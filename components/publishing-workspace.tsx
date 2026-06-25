import type { ReactNode } from "react";

export type PublishingTab = "calendar" | "campaigns" | "content" | "queue";

type PublishingWorkspaceHeaderProps = {
  activeTab: PublishingTab;
  title: string;
  description: string;
  counts?: Partial<Record<PublishingTab, number>>;
  meta?: ReactNode;
  action?: ReactNode;
  onTabChange?: (tab: PublishingTab) => void;
};

export function PublishingWorkspaceHeader({
  title,
  description,
  meta,
  action
}: PublishingWorkspaceHeaderProps) {
  return (
    <section className="app-studio-panel overflow-hidden rounded-lg">
      <div className="flex flex-col justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <p className="app-section-kicker text-[10px] font-black">فضای انتشار</p>
          <h1 className="mt-1 text-lg font-black text-app-text sm:text-xl">{title}</h1>
          <p className="mt-1 line-clamp-2 max-w-3xl text-xs leading-5 text-app-muted">{description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {meta}
          {action}
        </div>
      </div>
    </section>
  );
}


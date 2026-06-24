import { Check, type LucideIcon } from "lucide-react";

export type ComposerStep = {
  label: string;
  helper: string;
  icon: LucideIcon;
  state: "done" | "active" | "pending";
};

const stateClasses: Record<ComposerStep["state"], string> = {
  done: "text-emerald-700",
  active: "text-app-primary",
  pending: "text-slate-500"
};

const dotClasses: Record<ComposerStep["state"], string> = {
  done: "border-emerald-500 bg-emerald-500 text-white",
  active: "app-dot-pulse border-emerald-500 bg-emerald-500 text-white",
  pending: "border-slate-300 bg-white text-slate-400"
};

export function ComposerStepRail({ steps }: { steps: ComposerStep[] }) {
  const completed = steps.filter((step) => step.state === "done").length;

  return (
    <section className="app-studio-panel overflow-hidden rounded-lg">
      <div className="flex items-center justify-between border-b border-app-border px-3 py-3">
        <p className="text-sm font-black text-app-text">مسیر تولید</p>
        <span className="rounded bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">{completed}/{steps.length}</span>
      </div>
      <ol className="grid gap-1 px-3 py-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;

          return (
            <li key={step.label} className={`relative flex gap-3 rounded-md px-1 py-2.5 transition lg:bg-white/60 lg:px-2 ${stateClasses[step.state]}`}>
              {index < steps.length - 1 ? <span className="absolute right-[15px] top-9 h-[calc(100%-0.75rem)] border-r border-dashed border-slate-300 lg:hidden" /> : null}
              <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-black ${dotClasses[step.state]}`}>
                {step.state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate text-sm font-black text-app-text">{step.label}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-app-muted">{step.helper}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

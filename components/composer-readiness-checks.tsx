import { CheckCircle2, CircleAlert, Clock3 } from "lucide-react";

type ReadinessItem = {
  label: string;
  detail: string;
  done: boolean;
  required?: boolean;
};

type ComposerReadinessChecksProps = {
  items: ReadinessItem[];
};

export function ComposerReadinessChecks({ items }: ComposerReadinessChecksProps) {
  return (
    <div>
      {items.map((item, index) => {
        const Icon = item.done ? CheckCircle2 : item.required ? CircleAlert : Clock3;
        const color = item.done ? "text-emerald-700" : item.required ? "text-amber-700" : "text-slate-500";
        const dotColor = item.done ? "border-emerald-200 bg-emerald-50" : item.required ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50";

        return (
          <div key={item.label} className="relative flex items-start gap-3 pb-4 last:pb-0">
            {index < items.length - 1 ? <span className="absolute right-[15px] top-8 h-[calc(100%-1.6rem)] w-px bg-app-border" aria-hidden="true" /> : null}
            <span className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${dotColor}`}>
              <Icon className={`h-4 w-4 ${color}`} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-black text-app-text">{item.label}</p>
              <p className="mt-1 text-xs leading-6 text-app-muted">{item.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}


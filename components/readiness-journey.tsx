"use client";

import { CalendarClock, PenLine, Plug, ShieldCheck, Store } from "lucide-react";
import { Post } from "../lib/posts";
import {
  buildReadinessSteps,
  nextReadinessStep,
  ReadinessStep,
  RubikaSettings,
  StoreProfile
} from "../lib/workspace";
import { Button } from "./ui/button";
import { StatusRail, StatusToken } from "./workspace-ui";

type ReadinessJourneyProps = {
  store: StoreProfile | null;
  rubika: RubikaSettings | null;
  posts: Post[];
  loading?: boolean;
};

const stepIcons: Record<ReadinessStep["key"], typeof Store> = {
  store: Store,
  rubika: Plug,
  content: PenLine,
  schedule: CalendarClock
};

export function ReadinessJourney({ store, rubika, posts, loading = false }: ReadinessJourneyProps) {
  const steps = buildReadinessSteps({ store, rubika }, posts);
  const completedCount = steps.filter((step) => step.done).length;
  const progress = Math.round((completedCount / steps.length) * 100);
  const nextStep = nextReadinessStep(steps);
  const isReady = completedCount === steps.length;
  const workspaceCompleted = steps.slice(0, 2).filter((step) => step.done).length;
  const nextActionLabel = isReady ? "ایجاد پست جدید" : nextStep.label;
  const nextActionHref = isReady ? "/compose" : nextStep.href;

  return (
    <section className="space-y-4">
      <div className="app-studio-panel overflow-hidden rounded-lg">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px_240px]">
          <div className="border-b border-app-border px-4 py-4 lg:border-b-0 lg:border-l">
            <div className="flex flex-wrap items-center gap-2">
              <StatusToken tone={isReady ? "success" : "warning"}>{isReady ? "آماده عملیات" : "نیازمند تکمیل"}</StatusToken>
              <StatusToken tone={workspaceCompleted === 2 ? "success" : "warning"}>{workspaceCompleted} از 2 تنظیم پایه</StatusToken>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 shrink-0 text-app-primary" aria-hidden="true" />
              <h2 className="text-lg font-black text-app-text">آمادگی فضای کاری</h2>
            </div>
            <p className="mt-2 text-sm leading-7 text-app-muted">
              {isReady
                ? "پروفایل، کانال‌های انتشار، محتوا و زمان‌بندی فعال هستند. حالا تمرکز اصلی روی کیفیت پست‌ها و پایش نتیجه انتشار است."
                : "تنظیمات پایه و قدم‌های انتشار را در یک مسیر کوتاه و قابل پیگیری کامل کنید."}
            </p>
          </div>

          <div className="app-studio-grid border-b border-app-border bg-teal-50/70 p-4 lg:border-b-0 lg:border-l">
            <div className="flex items-center justify-between text-xs font-black text-app-muted">
              <span>آمادگی انتشار</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
              <div className={`app-progress h-full rounded-full ${isReady ? "bg-emerald-500" : "bg-amber-500"} transition-all`} style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 text-xs leading-5 text-app-muted">{completedCount} از {steps.length} مرحله تکمیل شده است.</p>
          </div>

          <div className="bg-slate-50 p-4">
            <p className="text-xs font-black text-app-muted">{isReady ? "اقدام پیشنهادی" : "قدم بعدی"}</p>
            <p className="mt-2 truncate text-sm font-black text-app-text">{nextActionLabel}</p>
            <Button href={nextActionHref} size="sm" className="mt-3 w-full">
              {isReady ? "ایجاد پست" : "ادامه مسیر"}
            </Button>
          </div>
        </div>
      </div>

      <StatusRail
        steps={steps.map((step, index) => {
          const Icon = stepIcons[step.key];
          return {
            label: step.label,
            description: loading ? "در حال بررسی..." : step.description,
            href: step.href,
            icon: <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
            meta: `${index + 1}/${steps.length}`,
            state: step.done ? "done" : step.key === nextStep.key ? "active" : "pending"
          };
        })}
      />
    </section>
  );
}

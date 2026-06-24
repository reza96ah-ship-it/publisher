import { CalendarCheck, CheckCircle2, Cloud, RotateCcw, Save, Sparkles } from "lucide-react";
import { Button } from "./ui/button";

type ComposerActionFooterProps = {
  savingAction: "draft" | "ready" | "schedule" | null;
  canSaveDraft: boolean;
  canMarkReady: boolean;
  canSchedule: boolean;
  hasSchedule?: boolean;
  isEditing?: boolean;
  autosaveLabel?: string;
  onUseDefaults: () => void;
  onCancel: () => void;
  onSaveDraft: () => void;
  onMarkReady: () => void;
  onSchedule: () => void;
};

export function ComposerActionFooter({
  savingAction,
  canSaveDraft,
  canMarkReady,
  canSchedule,
  hasSchedule = false,
  isEditing = false,
  autosaveLabel,
  onUseDefaults,
  onCancel,
  onSaveDraft,
  onMarkReady,
  onSchedule
}: ComposerActionFooterProps) {
  const saving = Boolean(savingAction);
  const primaryAction = hasSchedule ? "schedule" : canMarkReady ? "ready" : "draft";
  const primaryDisabled = primaryAction === "schedule" ? !canSchedule : primaryAction === "ready" ? !canMarkReady : !canSaveDraft;
  const primaryLabel = primaryAction === "schedule"
    ? savingAction === "schedule" ? "در حال زمان‌بندی..." : "زمان‌بندی پست"
    : primaryAction === "ready"
      ? savingAction === "ready" ? "در حال آماده‌سازی..." : "آماده برای زمان‌بندی"
      : savingAction === "draft" ? "در حال ذخیره..." : isEditing ? "ذخیره تغییرات" : "ذخیره پیش‌نویس";
  const PrimaryIcon = primaryAction === "schedule" ? CalendarCheck : primaryAction === "ready" ? CheckCircle2 : Save;
  const primaryHandler = primaryAction === "schedule" ? onSchedule : primaryAction === "ready" ? onMarkReady : onSaveDraft;

  return (
    <div className="sticky bottom-4 z-20 mt-4 overflow-hidden rounded-lg border border-white/70 bg-white/85 px-3 py-2.5 shadow-lift ring-1 ring-app-border/80 backdrop-blur-xl">
      <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-app-primary/25 to-transparent" aria-hidden="true" />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-sm font-black text-app-text">{hasSchedule ? "آماده بررسی و ورود به صف" : canMarkReady ? "محتوا آماده است؛ زمان‌بندی اختیاری است" : "پست را مرحله‌به‌مرحله کامل کنید"}</p>
          <p className="mt-1 text-xs leading-5 text-app-muted">
            {hasSchedule ? "پیش‌نمایش و کنترل‌های نهایی را بررسی کنید." : canMarkReady ? "می‌توانید پست را آماده کنید یا از بازرس انتشار زمان انتخاب کنید." : "عنوان، متن یا رسانه، و کانال انتشار وضعیت دکمه اصلی را تعیین می‌کنند."}
          </p>
          {autosaveLabel ? <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-slate-500"><Cloud className="h-3.5 w-3.5" aria-hidden="true" />{autosaveLabel}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onUseDefaults} disabled={saving}>
            <Sparkles className="ml-2 h-4 w-4" aria-hidden="true" />
            پیش‌فرض فروشگاه
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            <RotateCcw className="ml-2 h-4 w-4" aria-hidden="true" />
            بازنشانی
          </Button>
          {primaryAction !== "draft" ? (
            <Button type="button" variant="secondary" size="sm" onClick={onSaveDraft} disabled={saving || !canSaveDraft}>
              <Save className="ml-2 h-4 w-4" aria-hidden="true" />
              {isEditing ? "ذخیره تغییرات" : "ذخیره پیش‌نویس"}
            </Button>
          ) : null}
          <Button type="button" size="md" onClick={primaryHandler} disabled={saving || primaryDisabled} className="min-w-36">
            <PrimaryIcon className="ml-2 h-4 w-4" aria-hidden="true" />
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

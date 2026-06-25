import { Button } from "./ui/button";

type ComposerActionFooterProps = {
  saving: boolean;
  disabled?: boolean;
  onUseDefaults: () => void;
  onCancel: () => void;
};

export function ComposerActionFooter({ saving, disabled, onUseDefaults, onCancel }: ComposerActionFooterProps) {
  return (
    <div className="sticky bottom-0 z-10 mt-6 rounded-2xl border border-app-border bg-app-surface/95 p-4 shadow-soft backdrop-blur">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <p className="text-sm font-bold text-app-text">اقدام‌های پست</p>
          <p className="mt-1 text-xs leading-6 text-app-muted">در این فاز، ذخیره پیش‌نویس فعال است. زمان‌بندی و انتشار پس از تکمیل معماری زمان‌بندی اضافه می‌شود.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={onUseDefaults}>استفاده از پیش‌فرض فروشگاه</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>لغو</Button>
          <Button type="button" variant="secondary" disabled>زمان‌بندی</Button>
          <Button type="button" variant="secondary" disabled>انتشار آزمایشی</Button>
          <Button type="submit" disabled={saving || disabled}>{saving ? "در حال ذخیره..." : "ذخیره پیش‌نویس"}</Button>
        </div>
      </div>
    </div>
  );
}

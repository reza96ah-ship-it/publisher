import { FileText, ImagePlus, Images, Sparkles } from "lucide-react";
import { WorkspaceAvatar } from "./brand-mark";

type ComposerStartPanelProps = {
  storeName: string;
  storeCategory?: string;
  brandColor?: string;
  avatarUrl?: string;
  mediaPreviewUrls: string[];
  hasDefaults: boolean;
  onStartText: () => void;
  onUploadImage: () => void;
  onChooseMedia: () => void;
  onUseDefaults: () => void;
};

const actions = [
  {
    key: "upload",
    label: "آپلود تصویر تازه",
    description: "یک تصویر جدید را به کتابخانه و پست اضافه کنید.",
    icon: ImagePlus,
    tone: "border-blue-100 bg-blue-50/65 text-app-primary"
  },
  {
    key: "library",
    label: "انتخاب از کتابخانه",
    description: "از دارایی‌های آماده فضای کاری استفاده کنید.",
    icon: Images,
    tone: "border-teal-100 bg-teal-50/70 text-app-teal"
  },
  {
    key: "text",
    label: "شروع با متن",
    description: "برای اعلان، توضیح یا پست بدون تصویر بنویسید.",
    icon: FileText,
    tone: "border-slate-200 bg-slate-50 text-slate-700"
  },
  {
    key: "defaults",
    label: "استفاده از پیش‌فرض برند",
    description: "کپشن، CTA و هشتگ‌های پایه برند را وارد کنید.",
    icon: Sparkles,
    tone: "border-amber-100 bg-amber-50/70 text-amber-700"
  }
] as const;

export function ComposerStartPanel({
  storeName,
  storeCategory,
  brandColor,
  avatarUrl,
  mediaPreviewUrls,
  hasDefaults,
  onStartText,
  onUploadImage,
  onChooseMedia,
  onUseDefaults
}: ComposerStartPanelProps) {
  const handlers = {
    upload: onUploadImage,
    library: onChooseMedia,
    text: onStartText,
    defaults: onUseDefaults
  };

  return (
    <section className="app-studio-panel overflow-hidden rounded-lg">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <WorkspaceAvatar name={storeName} size="lg" color={brandColor} imageUrl={avatarUrl} />
            <div>
              <p className="app-section-kicker text-[10px] font-black">شروع سریع استودیو</p>
              <h2 className="mt-1 text-lg font-black text-app-text">پست را از مسیر مناسب شروع کنید</h2>
              <p className="mt-1 text-xs leading-5 text-app-muted">{storeName}{storeCategory ? ` · ${storeCategory}` : ""}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {actions.map((action) => {
              const Icon = action.icon;
              const disabled = action.key === "defaults" && !hasDefaults;
              return (
                <button
                  key={action.key}
                  type="button"
                  onClick={handlers[action.key]}
                  disabled={disabled}
                  className={`app-interactive flex min-h-24 items-start gap-3 rounded-md border p-3 text-right disabled:cursor-not-allowed disabled:opacity-45 ${action.tone}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/85 shadow-hairline">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-black">{action.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-app-muted">{action.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-app-border bg-app-canvas/70 p-4 lg:border-r lg:border-t-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-app-text">رسانه‌های آماده</p>
            <span className="text-[10px] font-bold text-app-muted">{mediaPreviewUrls.length ? `${mediaPreviewUrls.length} پیش‌نمایش` : "کتابخانه خالی"}</span>
          </div>
          {mediaPreviewUrls.length ? (
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {mediaPreviewUrls.map((previewUrl, index) => (
                <img key={previewUrl} src={previewUrl} alt={`رسانه آماده ${index + 1}`} className="aspect-square w-full rounded-md object-cover shadow-hairline" />
              ))}
            </div>
          ) : (
            <div className="mt-3 flex min-h-24 items-center justify-center rounded-md border border-dashed border-app-borderStrong bg-white/70 px-3 text-center text-xs leading-5 text-app-muted">
              اولین تصویر را هنگام ساخت پست اضافه کنید.
            </div>
          )}
          <p className="mt-3 text-[11px] leading-5 text-app-muted">تصویرها از کتابخانه همین فضای کاری نمایش داده می‌شوند.</p>
        </div>
      </div>
    </section>
  );
}


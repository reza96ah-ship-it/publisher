"use client";

import {
  BadgeCheck,
  Building2,
  CalendarClock,
  Clock3,
  Hash,
  ImageIcon,
  Megaphone,
  Palette,
  Phone,
  Save,
  Sparkles,
  Store as StoreIcon,
  Undo2,
  UploadCloud,
  X
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "../../components/app-shell";
import { AuthGate } from "../../components/auth-gate";
import { LoadingPanel } from "../../components/loading-skeleton";
import { useToast } from "../../components/toast-provider";
import { Button } from "../../components/ui/button";
import { Field, Input, Textarea } from "../../components/ui/form";
import { Tag } from "../../components/ui/tag";
import { NoticeBanner, StatusToken, WorkspacePage, WorkspacePanel } from "../../components/workspace-ui";
import { WorkspaceAvatar } from "../../components/brand-mark";
import { apiUrl, authHeaders } from "../../lib/posts";
import { notifyWorkspaceUpdated } from "../../lib/workspace";

type StoreForm = {
  name: string;
  category: string;
  phone: string;
  description: string;
  logo_asset_id: number | null;
  avatar_asset_id: number | null;
  brand_primary_color: string;
  brand_accent_color: string;
  brand_voice: string;
  default_cta: string;
  content_guidelines: string;
  default_hashtags: string;
  caption_footer: string;
  timezone: string;
};

type MediaAsset = {
  id: number;
  post_id: number | null;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  folder: string;
  tags: string;
};

type BrandAssetKind = "logo_asset_id" | "avatar_asset_id";

const emptyStore: StoreForm = {
  name: "",
  category: "",
  phone: "",
  description: "",
  logo_asset_id: null,
  avatar_asset_id: null,
  brand_primary_color: "#0F766E",
  brand_accent_color: "#2563EB",
  brand_voice: "",
  default_cta: "",
  content_guidelines: "",
  default_hashtags: "",
  caption_footer: "",
  timezone: "Asia/Tehran"
};

type ReadinessItem = {
  label: string;
  detail: string;
  done: boolean;
  required?: boolean;
};

function trim(value: string) {
  return value.trim();
}

function isHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

function normalizeStore(data: Partial<StoreForm> = {}): StoreForm {
  return {
    name: data.name ?? "",
    category: data.category ?? "",
    phone: data.phone ?? "",
    description: data.description ?? "",
    logo_asset_id: typeof data.logo_asset_id === "number" ? data.logo_asset_id : null,
    avatar_asset_id: typeof data.avatar_asset_id === "number" ? data.avatar_asset_id : null,
    brand_primary_color: isHexColor(data.brand_primary_color ?? "") ? data.brand_primary_color ?? "#0F766E" : "#0F766E",
    brand_accent_color: isHexColor(data.brand_accent_color ?? "") ? data.brand_accent_color ?? "#2563EB" : "#2563EB",
    brand_voice: data.brand_voice ?? "",
    default_cta: data.default_cta ?? "",
    content_guidelines: data.content_guidelines ?? "",
    default_hashtags: data.default_hashtags ?? "",
    caption_footer: data.caption_footer ?? "",
    timezone: data.timezone ?? "Asia/Tehran"
  };
}

function buildReadiness(form: StoreForm): ReadinessItem[] {
  return [
    {
      label: "نام فروشگاه",
      detail: "در هدر workspace و متن‌های آماده‌سازی استفاده می‌شود.",
      done: Boolean(trim(form.name)),
      required: true
    },
    {
      label: "دسته‌بندی فعالیت",
      detail: "به تولید کپشن و کمپین‌های منظم‌تر کمک می‌کند.",
      done: Boolean(trim(form.category))
    },
    {
      label: "منطقه زمانی",
      detail: "زمان‌بندی انتشار با این مقدار هماهنگ می‌شود.",
      done: Boolean(trim(form.timezone)),
      required: true
    },
    {
      label: "لوگو یا آواتار",
      detail: "برای تبدیل پیش‌نمایش‌ها و گزارش‌ها از حالت متنی به هویت واقعی برند.",
      done: Boolean(form.logo_asset_id || form.avatar_asset_id)
    },
    {
      label: "هشتگ‌های پیش‌فرض",
      detail: "برای شروع سریع‌تر composer و استانداردسازی خروجی.",
      done: Boolean(trim(form.default_hashtags))
    },
    {
      label: "لحن برند",
      detail: "راهنمای نوشتار کپشن و قالب‌های آینده composer.",
      done: Boolean(trim(form.brand_voice))
    },
    {
      label: "دعوت به اقدام",
      detail: "CTA ثابت که در پیش‌نمایش و شروع سریع composer استفاده می‌شود.",
      done: Boolean(trim(form.default_cta))
    },
    {
      label: "متن پایانی کپشن",
      detail: "CTA ثابت فروشگاه را به کپشن‌های آماده اضافه می‌کند.",
      done: Boolean(trim(form.caption_footer))
    }
  ];
}

function readinessScore(items: ReadinessItem[]) {
  if (items.length === 0) return 0;
  return Math.round((items.filter((item) => item.done).length / items.length) * 100);
}

function defaultCount(form: StoreForm) {
  return [form.logo_asset_id, form.avatar_asset_id, form.default_hashtags, form.caption_footer, form.description, form.brand_voice, form.default_cta, form.content_guidelines].filter(Boolean).length;
}

function previewCaption(form: StoreForm) {
  const pieces = [
    form.description || "توضیحات کوتاه فروشگاه اینجا نمایش داده می‌شود.",
    form.default_cta,
    form.caption_footer,
    form.default_hashtags || "#فروشگاه #خرید_آنلاین"
  ].filter(Boolean);
  return pieces.join("\n\n");
}

function ReadinessRow({ item }: { item: ReadinessItem }) {
  const Icon = item.done ? BadgeCheck : CalendarClock;
  return (
    <div className="flex items-start gap-3 border-b border-app-border py-3 first:pt-0 last:border-0 last:pb-0">
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${item.done ? "text-emerald-700" : item.required ? "text-amber-700" : "text-slate-400"}`} aria-hidden="true" />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-app-text">{item.label}</p>
          {item.required ? <Tag tone="warning">ضروری</Tag> : null}
        </div>
        <p className="mt-1 text-xs leading-6 text-app-muted">{item.detail}</p>
      </div>
    </div>
  );
}

function BrandAssetPicker({
  title,
  description,
  selectedId,
  previewUrl,
  assets,
  previewUrls,
  uploading,
  onUpload,
  onSelect,
  onClear
}: {
  title: string;
  description: string;
  selectedId: number | null;
  previewUrl: string;
  assets: MediaAsset[];
  previewUrls: Record<number, string>;
  uploading: boolean;
  onUpload: (file: File | undefined) => void;
  onSelect: (assetId: number | null) => void;
  onClear: () => void;
}) {
  const selectedAsset = assets.find((asset) => asset.id === selectedId);

  return (
    <div className="rounded-md border border-app-border bg-white p-3 shadow-hairline">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-app-text">{title}</p>
          <p className="mt-1 text-xs leading-5 text-app-muted">{description}</p>
        </div>
        {selectedId ? (
          <button type="button" onClick={onClear} className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-rose-600" aria-label={`حذف ${title}`}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[96px_minmax(0,1fr)]">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border border-app-border bg-app-surfaceMuted">
          {previewUrl ? (
            <img src={previewUrl} alt={title} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-7 w-7 text-slate-400" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 space-y-2">
          <label className="app-interactive flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-app-borderStrong bg-app-surfaceMuted px-3 py-2 text-xs font-black text-app-text hover:border-blue-300 hover:bg-blue-50">
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            {uploading ? "در حال آپلود..." : "آپلود تصویر"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => {
                onUpload(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </label>

          <select
            value={selectedId ?? ""}
            onChange={(event) => onSelect(event.target.value ? Number(event.target.value) : null)}
            className="min-h-11 w-full rounded-md border border-app-border bg-white px-3 py-2 text-xs font-bold text-app-text outline-none transition focus:border-app-primary focus:ring-2 focus:ring-blue-100"
          >
            <option value="">انتخاب از کتابخانه رسانه</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.original_filename}
              </option>
            ))}
          </select>

          {selectedAsset ? (
            <p className="truncate text-[11px] text-app-muted">
              {selectedAsset.folder || "بدون پوشه"} · {selectedAsset.content_type}
            </p>
          ) : (
            <p className="text-[11px] leading-5 text-app-muted">{assets.length ? "یا یکی از تصاویر موجود را انتخاب کنید." : "هنوز تصویر آماده‌ای در کتابخانه نیست."}</p>
          )}

          {selectedId && !previewUrls[selectedId] ? <p className="text-[11px] text-amber-700">پیش‌نمایش این دارایی در دسترس نیست.</p> : null}
        </div>
      </div>
    </div>
  );
}

export default function StorePage() {
  const { showToast } = useToast();
  const [form, setForm] = useState<StoreForm>(emptyStore);
  const [savedForm, setSavedForm] = useState<StoreForm>(emptyStore);
  const [brandPrimaryColorDraft, setBrandPrimaryColorDraft] = useState(emptyStore.brand_primary_color);
  const [brandAccentColorDraft, setBrandAccentColorDraft] = useState(emptyStore.brand_accent_color);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<Record<number, string>>({});
  const [uploadingAsset, setUploadingAsset] = useState<BrandAssetKind | null>(null);

  useEffect(() => {
    async function loadStore() {
      const [response, mediaResponse] = await Promise.all([
        fetch(`${apiUrl}/stores/active`, { headers: authHeaders() }),
        fetch(`${apiUrl}/media`, { headers: authHeaders() })
      ]);

      if (!response.ok) throw new Error("خطا در دریافت اطلاعات فروشگاه");

      const data = await response.json();
      if (mediaResponse.ok) {
        setMediaAssets(await mediaResponse.json());
      }
      if (data) {
        const nextForm = normalizeStore(data);
        setForm(nextForm);
        setSavedForm(nextForm);
      }

      setLoading(false);
    }

    loadStore().catch(() => {
      setError("خطا در دریافت اطلاعات فروشگاه");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setBrandPrimaryColorDraft(isHexColor(form.brand_primary_color) ? form.brand_primary_color : "#0F766E");
  }, [form.brand_primary_color]);

  useEffect(() => {
    setBrandAccentColorDraft(isHexColor(form.brand_accent_color) ? form.brand_accent_color : "#2563EB");
  }, [form.brand_accent_color]);

  const readinessItems = useMemo(() => buildReadiness(form), [form]);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(savedForm), [form, savedForm]);
  const score = readinessScore(readinessItems);
  const requiredReady = readinessItems.filter((item) => item.required).every((item) => item.done);
  const imageAssets = useMemo(() => mediaAssets.filter((asset) => asset.content_type.startsWith("image/")), [mediaAssets]);
  const logoUrl = form.logo_asset_id ? mediaPreviewUrls[form.logo_asset_id] : "";
  const avatarUrl = form.avatar_asset_id ? mediaPreviewUrls[form.avatar_asset_id] : "";

  useEffect(() => {
    if (mediaAssets.length === 0) {
      setMediaPreviewUrls({});
      return;
    }

    let cancelled = false;
    const createdUrls: string[] = [];

    async function loadPreviews() {
      const entries = await Promise.all(
        mediaAssets
          .filter((asset) => asset.content_type.startsWith("image/"))
          .map(async (asset) => {
            try {
              const response = await fetch(`${apiUrl}/media/${asset.id}/file`, { headers: authHeaders() });
              if (!response.ok) return null;
              const blob = await response.blob();
              const url = URL.createObjectURL(blob);
              createdUrls.push(url);
              return [asset.id, url] as const;
            } catch {
              return null;
            }
          })
      );

      if (!cancelled) {
        setMediaPreviewUrls(Object.fromEntries(entries.filter(Boolean) as Array<[number, string]>));
      } else {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
      }
    }

    loadPreviews();

    return () => {
      cancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [mediaAssets]);

  function updateField(field: keyof StoreForm, value: StoreForm[keyof StoreForm]) {
    setMessage("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  function commitBrandColor(field: "brand_primary_color" | "brand_accent_color", value: string) {
    if (!isHexColor(value)) return;
    updateField(field, value.toUpperCase());
  }

  async function uploadBrandAsset(kind: BrandAssetKind, file: File | undefined) {
    if (!file) return;
    setMessage("");
    setError("");
    setUploadingAsset(kind);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "brand");
      formData.append("tags", kind === "logo_asset_id" ? "brand,logo" : "brand,avatar");
      const response = await fetch(`${apiUrl}/media`, {
        method: "POST",
        headers: authHeaders(),
        body: formData
      });
      if (!response.ok) throw new Error("آپلود دارایی برند ناموفق بود");
      const asset = (await response.json()) as MediaAsset;
      setMediaAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      updateField(kind, asset.id);
      showToast({ title: "دارایی برند آپلود شد", description: kind === "logo_asset_id" ? "لوگوی برند انتخاب شد." : "آواتار برند انتخاب شد.", tone: "success" });
    } catch (err) {
      const nextError = err instanceof Error ? err.message : "خطای آپلود دارایی برند";
      setError(nextError);
      showToast({ title: "آپلود ناموفق بود", description: nextError, tone: "alert" });
    } finally {
      setUploadingAsset(null);
    }
  }

  function resetChanges() {
    setForm(savedForm);
    setMessage("");
    setError("");
  }

  async function saveStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);

    try {
      const response = await fetch(`${apiUrl}/stores/active`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders()
        },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        throw new Error("ذخیره پروفایل فروشگاه ناموفق بود");
      }

      const data = await response.json();
      const nextForm = normalizeStore(data);
      setForm(nextForm);
      setSavedForm(nextForm);
      setMessage("پروفایل فروشگاه ذخیره شد");
      showToast({ title: "پروفایل فروشگاه ذخیره شد", description: "متن‌های پایه از این لحظه در composer قابل استفاده‌اند.", tone: "success" });
      notifyWorkspaceUpdated();
    } catch (err) {
      const nextError = err instanceof Error ? err.message : "خطای ذخیره اطلاعات";
      setError(nextError);
      showToast({ title: "ذخیره پروفایل ناموفق بود", description: nextError, tone: "alert" });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function warnAboutUnsavedChanges(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
    }

    window.addEventListener("beforeunload", warnAboutUnsavedChanges);
    return () => window.removeEventListener("beforeunload", warnAboutUnsavedChanges);
  }, [dirty]);

  return (
    <AuthGate>
      <AppShell>
        <WorkspacePage>
          <section className="app-studio-panel rounded-lg px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div>
                <p className="text-[10px] font-black text-app-primary">تنظیمات برند</p>
                <h1 className="mt-1 text-xl font-black text-app-text">پروفایل فروشگاه</h1>
                <p className="mt-1 text-xs leading-5 text-app-muted">هویت فروشگاه و متن‌های ثابت را برای تولید محتوای منظم نگه دارید.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusToken tone={requiredReady ? "success" : "warning"}>{requiredReady ? "حداقل آماده" : "نیازمند تکمیل"}</StatusToken>
                <StatusToken tone={saving || dirty ? "warning" : "success"}>{saving ? "در حال ذخیره" : dirty ? "تغییرات ذخیره نشده" : "ذخیره شده"}</StatusToken>
              </div>
            </div>
          </section>

          <section className="grid overflow-hidden rounded-md border border-app-border bg-white sm:grid-cols-3">
            {[
              { label: "آمادگی پروفایل", value: `${score}%`, detail: "نام و منطقه زمانی پایه‌های ضروری‌اند", icon: StoreIcon, tone: requiredReady ? "text-emerald-700" : "text-amber-700" },
              { label: "کیت برند", value: `${defaultCount(form)}/8`, detail: "لوگو، آواتار، لحن، CTA و قوانین", icon: Palette, tone: "text-app-primary" },
              { label: "وضعیت ویرایش", value: dirty ? "ذخیره نشده" : "به‌روز", detail: dirty ? "نسخه جدید را ثبت کنید" : "آخرین تغییرات ثبت شده است", icon: Save, tone: dirty ? "text-amber-700" : "text-emerald-700" }
            ].map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="flex min-w-0 items-start gap-3 border-b border-app-border p-3 sm:border-b-0 sm:border-l sm:last:border-l-0">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-50 ${metric.tone}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-app-muted">{metric.label}</p>
                    <p className="mt-0.5 truncate text-base font-black text-app-text">{metric.value}</p>
                    <p className="truncate text-[11px] text-app-muted">{metric.detail}</p>
                  </div>
                </div>
              );
            })}
          </section>

          {message ? <NoticeBanner tone="success">{message}</NoticeBanner> : null}
          {error ? <NoticeBanner tone="alert">{error}</NoticeBanner> : null}

          {loading ? (
            <WorkspacePanel title="پروفایل فروشگاه">
              <LoadingPanel />
            </WorkspacePanel>
          ) : (
            <form onSubmit={saveStore}>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-3 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
                  <WorkspacePanel
                    title="هویت فروشگاه"
                    description="مشخصات اصلی برند و اطلاعات عملیاتی فروشگاه را یک‌جا مدیریت کنید."
                    action={<Tag tone={requiredReady ? "success" : "warning"}>{requiredReady ? "اطلاعات پایه آماده" : "نیازمند تکمیل"}</Tag>}
                    bodyClassName="p-0"
                  >
                    <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(240px,0.65fr)]">
                      <Field label="نام فروشگاه" required hint="نامی که در workspace و پیش‌نمایش کپشن نمایش داده می‌شود.">
                        <Input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="مثلاً فروشگاه سپهر" required />
                      </Field>

                      <Field label="دسته‌بندی فعالیت" hint="برای دسته‌بندی محتوا و ساخت کمپین‌های منظم‌تر.">
                        <Input value={form.category} onChange={(event) => updateField("category", event.target.value)} placeholder="مثلاً پوشاک یا محصولات آرایشی" />
                      </Field>
                    </div>

                    <div className="grid gap-3 border-t border-app-border bg-slate-50/70 p-3 sm:p-4 md:grid-cols-2">
                      <Field label="شماره تماس" hint="در صورت نیاز برای CTA و اطلاعات تماس مشتری استفاده می‌شود.">
                        <Input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="0912 000 0000" className="text-left" dir="ltr" inputMode="tel" />
                      </Field>

                      <Field label="منطقه زمانی" required hint="مبنای زمان‌بندی صف انتشار برای این workspace.">
                        <div className="relative">
                          <Input value={form.timezone} readOnly className="bg-white pl-10 text-left text-slate-600" dir="ltr" required />
                          <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        </div>
                      </Field>
                    </div>
                  </WorkspacePanel>

                  <WorkspacePanel
                    title="هویت بصری برند"
                    description="لوگو و آواتار را از کتابخانه رسانه انتخاب کنید یا مستقیم همین‌جا آپلود کنید."
                    action={<Tag tone={form.logo_asset_id || form.avatar_asset_id ? "success" : "warning"}>{form.logo_asset_id || form.avatar_asset_id ? "دارایی بصری آماده" : "بدون تصویر برند"}</Tag>}
                  >
                    <div className="grid gap-4 lg:grid-cols-2">
                      <BrandAssetPicker
                        title="لوگوی برند"
                        description="برای کارت‌های برند، گزارش‌ها و فضاهای رسمی‌تر استفاده می‌شود."
                        selectedId={form.logo_asset_id}
                        previewUrl={logoUrl}
                        assets={imageAssets}
                        previewUrls={mediaPreviewUrls}
                        uploading={uploadingAsset === "logo_asset_id"}
                        onUpload={(file) => void uploadBrandAsset("logo_asset_id", file)}
                        onSelect={(assetId) => updateField("logo_asset_id", assetId)}
                        onClear={() => updateField("logo_asset_id", null)}
                      />

                      <BrandAssetPicker
                        title="آواتار انتشار"
                        description="در پیش‌نمایش محتوا، composer و هویت سریع workspace دیده می‌شود."
                        selectedId={form.avatar_asset_id}
                        previewUrl={avatarUrl}
                        assets={imageAssets}
                        previewUrls={mediaPreviewUrls}
                        uploading={uploadingAsset === "avatar_asset_id"}
                        onUpload={(file) => void uploadBrandAsset("avatar_asset_id", file)}
                        onSelect={(assetId) => updateField("avatar_asset_id", assetId)}
                        onClear={() => updateField("avatar_asset_id", null)}
                      />
                    </div>
                  </WorkspacePanel>

                  <WorkspacePanel
                    title="کیت برند"
                    description="لحن، رنگ و CTA پیش‌فرض برند را برای composer و پیش‌نمایش انتشار آماده کنید."
                    action={<Tag tone={form.brand_voice || form.default_cta ? "success" : "warning"}>{form.brand_voice || form.default_cta ? "هویت محتوایی آماده" : "نیازمند تعریف"}</Tag>}
                  >
                    <div className="grid gap-5 lg:grid-cols-2">
                      <Field label="رنگ اصلی برند" hint="در آواتار، پیش‌نمایش و وضعیت‌های برند استفاده می‌شود.">
                        <div className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)] items-center gap-3">
                          <Input
                            type="color"
                            value={isHexColor(brandPrimaryColorDraft) ? brandPrimaryColorDraft : "#0F766E"}
                            onInput={(event) => setBrandPrimaryColorDraft(event.currentTarget.value)}
                            onChange={(event) => setBrandPrimaryColorDraft(event.target.value)}
                            onBlur={(event) => commitBrandColor("brand_primary_color", event.currentTarget.value)}
                            className="h-11 w-16 shrink-0 p-1"
                            aria-label="رنگ اصلی برند"
                          />
                          <Input
                            value={form.brand_primary_color}
                            onChange={(event) => updateField("brand_primary_color", event.target.value)}
                            className="text-left uppercase"
                            dir="ltr"
                          />
                        </div>
                      </Field>

                      <Field label="رنگ مکمل برند" hint="برای تاکیدهای ثانویه، CTA و گزارش‌های آینده.">
                        <div className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)] items-center gap-3">
                          <Input
                            type="color"
                            value={isHexColor(brandAccentColorDraft) ? brandAccentColorDraft : "#2563EB"}
                            onInput={(event) => setBrandAccentColorDraft(event.currentTarget.value)}
                            onChange={(event) => setBrandAccentColorDraft(event.target.value)}
                            onBlur={(event) => commitBrandColor("brand_accent_color", event.currentTarget.value)}
                            className="h-11 w-16 shrink-0 p-1"
                            aria-label="رنگ مکمل برند"
                          />
                          <Input
                            value={form.brand_accent_color}
                            onChange={(event) => updateField("brand_accent_color", event.target.value)}
                            className="text-left uppercase"
                            dir="ltr"
                          />
                        </div>
                      </Field>

                      <Field label="لحن برند" hint="مثلاً صمیمی، مطمئن، اقتصادی، لوکس یا آموزشی.">
                        <Textarea
                          value={form.brand_voice}
                          onChange={(event) => updateField("brand_voice", event.target.value)}
                          placeholder="مثلاً صمیمی، کوتاه، قابل اعتماد و متمرکز بر خرید آسان"
                        />
                      </Field>

                      <Field label="دعوت به اقدام پیش‌فرض" hint="CTA کوتاه که در شروع سریع composer و پیش‌نمایش استفاده می‌شود.">
                        <Textarea
                          value={form.default_cta}
                          onChange={(event) => updateField("default_cta", event.target.value)}
                          placeholder="برای سفارش همین حالا پیام بدهید."
                        />
                      </Field>

                      <div className="lg:col-span-2">
                        <Field label="قوانین محتوایی برند" hint="مواردی که کپشن‌ها باید رعایت کنند یا از آن دوری کنند.">
                          <Textarea
                            value={form.content_guidelines}
                            onChange={(event) => updateField("content_guidelines", event.target.value)}
                            placeholder="مثلاً قیمت را واضح بنویس، از اغراق زیاد پرهیز کن، همیشه روش سفارش را اضافه کن."
                          />
                        </Field>
                      </div>
                    </div>
                  </WorkspacePanel>

                  <WorkspacePanel title="پیش‌فرض‌های انتشار" description="متن‌های تکرارشونده را یک‌بار تنظیم کنید تا composer شروع سریع‌تری داشته باشد.">
                    <div className="grid gap-5 lg:grid-cols-2">
                  <Field label="توضیحات کوتاه فروشگاه" hint="یک توضیح کوتاه که شخصیت برند و پیشنهاد اصلی را مشخص کند.">
                    <Textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} />
                  </Field>

                  <Field label="هشتگ‌های پیش‌فرض" hint="در هر خط یا با فاصله بنویسید.">
                    <Textarea value={form.default_hashtags} onChange={(event) => updateField("default_hashtags", event.target.value)} placeholder="#فروشگاه #خرید_آنلاین" />
                  </Field>

                  <Field label="متن پایانی کپشن" hint="دعوت به اقدام ثابت مثل سفارش، تماس یا مراجعه حضوری.">
                    <Textarea value={form.caption_footer} onChange={(event) => updateField("caption_footer", event.target.value)} placeholder="برای سفارش پیام بدهید." />
                  </Field>

                      <div className="lg:col-span-2">
                        <NoticeBanner>
                          composer از این اطلاعات برای شروع سریع‌تر کپشن‌ها استفاده می‌کند.
                        </NoticeBanner>
                      </div>
                    </div>
                  </WorkspacePanel>

                  <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-md border border-app-border bg-white/95 p-3 shadow-lg shadow-slate-200/60 backdrop-blur md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-black text-app-text">{dirty ? "تغییرات آماده ذخیره است" : "پروفایل فروشگاه به‌روز است"}</p>
                      <p className="mt-1 text-xs text-app-muted">{dirty ? "برای استفاده در composer، نسخه جدید را ثبت کنید." : "هر تغییر جدید در این نوار مشخص می‌شود."}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" onClick={resetChanges} disabled={!dirty || saving}>
                        <Undo2 className="ml-2 h-4 w-4" aria-hidden="true" />
                        بازگردانی
                      </Button>
                      <Button type="submit" disabled={!dirty || saving}>
                        <Save className="ml-2 h-4 w-4" aria-hidden="true" />
                        {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
                      </Button>
                    </div>
                  </div>
                </div>

                <aside className="hidden space-y-3 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
              <WorkspacePanel title="چک‌لیست آماده‌سازی" description="برای یک workspace قابل اتکا، این موارد را کامل نگه دارید.">
                <div className="space-y-0">
                  {readinessItems.map((item) => <ReadinessRow key={item.label} item={item} />)}
                </div>
              </WorkspacePanel>

              <WorkspacePanel title="پیش‌نمایش کپشن پایه" description="خروجی پایه‌ای که در کپشن‌ها تکرار می‌شود.">
                <div className="rounded-md border border-app-border bg-slate-50 p-4">
                  <div className="mb-4 flex items-center gap-3 border-b border-app-border pb-3">
                    <WorkspaceAvatar name={form.name || "نام فروشگاه"} color={form.brand_primary_color} imageUrl={avatarUrl || logoUrl} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-app-text">{form.name || "نام فروشگاه"}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-app-muted">
                        <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {form.category || "دسته‌بندی فروشگاه"}
                      </p>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{previewCaption(form)}</p>
                  {logoUrl ? (
                    <div className="mt-4 rounded-md border border-app-border bg-white p-3">
                      <p className="mb-2 text-[11px] font-black text-app-muted">لوگوی ثبت‌شده</p>
                      <img src={logoUrl} alt="لوگوی برند" className="max-h-20 max-w-full rounded object-contain" />
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-3 text-xs text-app-muted">
                  <p className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    {form.brand_voice || "لحن برند هنوز تعریف نشده"}
                  </p>
                  <p className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4" aria-hidden="true" />
                    {form.default_cta || "CTA پیش‌فرض هنوز خالی است"}
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    {form.phone || "شماره تماس ثبت نشده"}
                  </p>
                  <p className="flex items-center gap-2">
                    <Hash className="h-4 w-4" aria-hidden="true" />
                    {form.default_hashtags ? "هشتگ پیش‌فرض آماده است" : "هشتگ پیش‌فرض هنوز خالی است"}
                  </p>
                </div>
              </WorkspacePanel>

              <WorkspacePanel title="مرحله بعدی" description="بعد از هویت برند، کانال‌های انتشار را کامل کنید.">
                <Button href="/channels" className="w-full">باز کردن مرکز کانال‌ها</Button>
              </WorkspacePanel>
                </aside>
              </div>
            </form>
          )}
        </WorkspacePage>
      </AppShell>
    </AuthGate>
  );
}


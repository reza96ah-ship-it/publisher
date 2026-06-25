"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuthGate } from "../../components/auth-gate";
import { AppShell } from "../../components/app-shell";
import { ComposerActionFooter } from "../../components/composer-action-footer";
import { PageHeader } from "../../components/page-header";
import { RubikaPostPreview } from "../../components/rubika-post-preview";
import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/card";
import { Field, Input, Select, Textarea } from "../../components/ui/form";
import { Tag } from "../../components/ui/tag";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Store = {
  default_hashtags: string;
  caption_footer: string;
};

type MediaAsset = {
  id: number;
  post_id: number | null;
  original_filename: string;
  content_type: string;
  size_bytes: number;
};

const emptyForm = {
  title: "",
  caption: "",
  hashtags: "",
  platform: "rubika"
};

export default function ComposePage() {
  const [store, setStore] = useState<Store | null>(null);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<Record<number, string>>({});
  const [form, setForm] = useState(emptyForm);
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePreviewUrl, setSelectedFilePreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedMedia = useMemo(() => {
    if (!selectedMediaId) return null;
    return mediaAssets.find((asset) => String(asset.id) === selectedMediaId) ?? null;
  }, [mediaAssets, selectedMediaId]);

  const previewImageUrl = selectedFilePreviewUrl || (selectedMedia ? mediaPreviewUrls[selectedMedia.id] : "");

  const finalPreview = useMemo(() => {
    return [form.caption, form.caption ? store?.caption_footer : "", form.hashtags]
      .filter(Boolean)
      .join("\n\n");
  }, [form.caption, form.hashtags, store?.caption_footer]);

  const captionLength = form.caption.length;
  const hashtagCount = form.hashtags.split(/\s+/).filter((item) => item.startsWith("#")).length;

  function token() {
    return window.localStorage.getItem("rubika_publisher_access") ?? "";
  }

  async function loadData() {
    setLoading(true);
    const headers = { Authorization: `Bearer ${token()}` };
    const [storeResponse, mediaResponse] = await Promise.all([
      fetch(`${apiUrl}/stores/active`, { headers }),
      fetch(`${apiUrl}/media`, { headers })
    ]);

    if (storeResponse.ok) setStore(await storeResponse.json());
    if (mediaResponse.ok) setMediaAssets(await mediaResponse.json());
    setLoading(false);
  }

  useEffect(() => {
    loadData().catch(() => {
      setError("خطا در دریافت اطلاعات اولیه composer");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setSelectedFilePreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setSelectedFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  useEffect(() => {
    if (mediaAssets.length === 0) {
      setMediaPreviewUrls({});
      return;
    }

    let cancelled = false;
    const createdUrls: string[] = [];

    async function loadPreviews() {
      const imageAssets = mediaAssets.filter((asset) => asset.content_type.startsWith("image/"));
      const entries = await Promise.all(
        imageAssets.map(async (asset) => {
          try {
            const response = await fetch(`${apiUrl}/media/${asset.id}/file`, {
              headers: { Authorization: `Bearer ${token()}` }
            });
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

  function updateField(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (message) setMessage("");
  }

  function useDefaults() {
    setForm((current) => ({
      ...current,
      hashtags: store?.default_hashtags || current.hashtags
    }));
    if (message) setMessage("");
  }

  function resetComposer(options: { clearStatus?: boolean } = { clearStatus: true }) {
    setForm(emptyForm);
    setSelectedMediaId("");
    setSelectedFile(null);

    if (options.clearStatus) {
      setMessage("");
      setError("");
    }
  }

  async function uploadSelectedFile() {
    if (!selectedFile) return null;

    const formData = new FormData();
    formData.append("file", selectedFile);
    const response = await fetch(`${apiUrl}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}` },
      body: formData
    });

    if (!response.ok) throw new Error("آپلود تصویر ناموفق بود");
    return response.json() as Promise<MediaAsset>;
  }

  async function attachMedia(assetId: number, postId: number | null) {
    const response = await fetch(`${apiUrl}/media/${assetId}/attach`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`
      },
      body: JSON.stringify({ post_id: postId })
    });

    if (!response.ok) throw new Error("اتصال تصویر به پست ناموفق بود");
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${apiUrl}/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`
        },
        body: JSON.stringify(form)
      });

      if (!response.ok) throw new Error("ذخیره پیش‌نویس ناموفق بود");
      const savedPost = await response.json();

      const uploadedAsset = await uploadSelectedFile();
      if (uploadedAsset) {
        await attachMedia(uploadedAsset.id, savedPost.id);
      } else if (selectedMediaId) {
        await attachMedia(Number(selectedMediaId), savedPost.id);
      }

      resetComposer({ clearStatus: false });
      setMessage("پست به عنوان پیش‌نویس ذخیره شد");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای ذخیره پیش‌نویس");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGate>
      <AppShell>
        <PageHeader
          eyebrow="Phase 3 — Composer-Centric Creation"
          title="ایجاد پست روبیکا"
          description="پست را از یک محیط متمرکز بسازید: تصویر، کپشن، هشتگ، پیش‌نمایش و ذخیره پیش‌نویس در یک جریان واحد."
          actionLabel="مدیریت پست‌ها"
          actionHref="/posts"
        />

        <form onSubmit={saveDraft} className="grid gap-5 xl:grid-cols-5">
          <section className="space-y-5 xl:col-span-3">
            <SectionCard title="رسانه پست" description="تصویر جدید آپلود کنید یا از کتابخانه رسانه انتخاب کنید.">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-dashed border-app-border bg-slate-50 p-4">
                  <p className="mb-2 text-sm font-semibold text-app-text">آپلود تصویر جدید</p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      setSelectedFile(event.target.files?.[0] ?? null);
                      if (event.target.files?.[0]) setSelectedMediaId("");
                      if (message) setMessage("");
                    }}
                    className="w-full text-sm text-app-muted"
                  />
                  {selectedFilePreviewUrl ? (
                    <img src={selectedFilePreviewUrl} alt="پیش‌نمایش فایل انتخاب‌شده" className="mt-4 aspect-video w-full rounded-xl object-cover ring-1 ring-app-border" />
                  ) : null}
                </div>

                <div className="rounded-2xl border border-app-border bg-white p-4">
                  <Field label="انتخاب از کتابخانه">
                    <Select
                      value={selectedMediaId}
                      onChange={(event) => {
                        setSelectedMediaId(event.target.value);
                        if (event.target.value) setSelectedFile(null);
                        if (message) setMessage("");
                      }}
                    >
                      <option value="">بدون تصویر</option>
                      {mediaAssets.map((asset) => (
                        <option key={asset.id} value={asset.id}>{asset.original_filename}</option>
                      ))}
                    </Select>
                  </Field>
                  {loading ? <p className="mt-3 text-xs text-app-muted">در حال دریافت رسانه‌ها...</p> : null}
                  {selectedMedia ? (
                    <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                      {mediaPreviewUrls[selectedMedia.id] ? (
                        <img src={mediaPreviewUrls[selectedMedia.id]} alt={selectedMedia.original_filename} className="h-14 w-14 rounded-xl object-cover ring-1 ring-app-border" />
                      ) : null}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-app-text">{selectedMedia.original_filename}</p>
                        <p className="text-xs text-app-muted">از کتابخانه رسانه</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="متن پست" description="عنوان داخلی، کپشن عمومی و هشتگ‌ها را تنظیم کنید.">
              <div className="grid gap-5">
                <Field label="عنوان داخلی پست" required hint="این عنوان برای مدیریت داخلی استفاده می‌شود و در روبیکا نمایش داده نمی‌شود.">
                  <Input
                    value={form.title}
                    onChange={(event) => updateField("title", event.target.value)}
                    placeholder="مثلاً معرفی محصول جدید"
                    required
                  />
                </Field>

                <Field label="کپشن" hint={`${captionLength} کاراکتر`}>
                  <Textarea
                    value={form.caption}
                    onChange={(event) => updateField("caption", event.target.value)}
                    className="min-h-44"
                    placeholder="متن پست روبیکا را وارد کنید..."
                  />
                </Field>

                <Field label="هشتگ‌ها" hint={`${hashtagCount} هشتگ شناسایی شد`}>
                  <Textarea
                    value={form.hashtags}
                    onChange={(event) => updateField("hashtags", event.target.value)}
                    className="min-h-24"
                    placeholder="#روبیکا #فروشگاه #محصول"
                  />
                </Field>

                <div className="flex flex-wrap gap-2">
                  <Tag tone="primary">مقصد: روبیکا</Tag>
                  <Tag tone={previewImageUrl ? "success" : "warning"}>{previewImageUrl ? "تصویر انتخاب شده" : "بدون تصویر"}</Tag>
                  <Tag tone={form.caption ? "success" : "neutral"}>{form.caption ? "کپشن آماده" : "کپشن خالی"}</Tag>
                </div>
              </div>
            </SectionCard>

            {message ? <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
            {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

            <ComposerActionFooter
              saving={saving}
              disabled={!form.title.trim()}
              onUseDefaults={useDefaults}
              onCancel={resetComposer}
            />
          </section>

          <aside className="xl:col-span-2">
            <div className="sticky top-24 space-y-5">
              <SectionCard title="پیش‌نمایش روبیکا" description="پیش‌نمایش نهایی تصویر، کپشن، فوتر فروشگاه و هشتگ‌ها.">
                <RubikaPostPreview imageUrl={previewImageUrl} caption={finalPreview} destination="فروشگاه نمونه" />
              </SectionCard>

              <SectionCard title="راهنمای سریع">
                <div className="space-y-3 text-sm leading-7 text-app-muted">
                  <p>۱. تصویر را آپلود یا از کتابخانه انتخاب کنید.</p>
                  <p>۲. کپشن و هشتگ‌ها را کامل کنید.</p>
                  <p>۳. پیش‌نمایش را بررسی کنید.</p>
                  <p>۴. فعلاً پست را به عنوان پیش‌نویس ذخیره کنید.</p>
                </div>
                <Button href="/media" variant="secondary" className="mt-4 w-full">رفتن به کتابخانه رسانه</Button>
              </SectionCard>
            </div>
          </aside>
        </form>
      </AppShell>
    </AuthGate>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { AuthGate } from "../../components/auth-gate";
import { AppShell } from "../../components/app-shell";
import { PageHeader } from "../../components/page-header";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type MediaAsset = {
  id: number;
  post_id: number | null;
  original_filename: string;
  content_type: string;
  size_bytes: number;
};

type PostOption = {
  id: number;
  title: string;
  status: string;
};

export default function MediaPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [posts, setPosts] = useState<PostOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [selectedFilePreviewUrl, setSelectedFilePreviewUrl] = useState("");
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function token() {
    return window.localStorage.getItem("rubika_publisher_access") ?? "";
  }

  async function loadData() {
    setLoading(true);
    const headers = { Authorization: `Bearer ${token()}` };
    const mediaResponse = await fetch(`${apiUrl}/media`, { headers });
    const postsResponse = await fetch(`${apiUrl}/posts`, { headers });
    if (mediaResponse.ok) setAssets(await mediaResponse.json());
    if (postsResponse.ok) setPosts(await postsResponse.json());
    setLoading(false);
  }

  useEffect(() => {
    loadData().catch(() => {
      setError("خطا در دریافت رسانه‌ها");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!file) {
      setSelectedFilePreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(file);
    setSelectedFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (assets.length === 0) {
      setMediaPreviewUrls({});
      return;
    }

    let cancelled = false;
    const createdUrls: string[] = [];

    async function loadPreviews() {
      const imageAssets = assets.filter((asset) => asset.content_type.startsWith("image/"));
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
  }, [assets]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${apiUrl}/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
        body: formData
      });
      if (!response.ok) throw new Error("آپلود تصویر ناموفق بود");
      setFile(null);
      setMessage("تصویر آپلود شد");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای آپلود تصویر");
    } finally {
      setUploading(false);
    }
  }

  async function attachToPost(assetId: number, value: string) {
    setMessage("");
    setError("");
    const postId = value ? Number(value) : null;
    const response = await fetch(`${apiUrl}/media/${assetId}/attach`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`
      },
      body: JSON.stringify({ post_id: postId })
    });

    if (!response.ok) {
      setError("اتصال تصویر به پست ناموفق بود");
      return;
    }

    setMessage("اتصال تصویر به پست ذخیره شد");
    await loadData();
  }

  function formatSize(size: number) {
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <AuthGate>
      <AppShell>
        <PageHeader
          eyebrow="Phase 07 — Media Library"
          title="کتابخانه رسانه"
          description="تصاویر محصول را آپلود، پیش‌نمایش و به پست‌های پیش‌نویس وصل کنید."
        />

        <section className="grid gap-5 xl:grid-cols-4">
          <form onSubmit={upload} className="rounded-2xl border border-app-border bg-app-surface p-6 shadow-soft xl:col-span-1">
            <h2 className="text-lg font-bold">آپلود تصویر</h2>
            <p className="mt-2 text-sm leading-7 text-app-muted">فرمت‌های مجاز: JPG، PNG، WEBP تا ۸ مگابایت.</p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="mt-5 w-full rounded-xl border border-dashed border-app-border bg-slate-50 p-4 text-sm"
            />
            {selectedFilePreviewUrl ? (
              <img
                src={selectedFilePreviewUrl}
                alt="پیش‌نمایش تصویر انتخاب‌شده"
                className="mt-4 aspect-video w-full rounded-xl object-cover ring-1 ring-app-border"
              />
            ) : null}
            <button
              type="submit"
              disabled={!file || uploading}
              className="mt-5 w-full rounded-xl bg-app-primary px-5 py-3 text-sm font-semibold text-white hover:bg-app-primaryHover disabled:opacity-60"
            >
              {uploading ? "در حال آپلود..." : "آپلود تصویر"}
            </button>
            {message ? <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
            {error ? <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          </form>

          <div className="rounded-2xl border border-app-border bg-app-surface p-6 shadow-soft xl:col-span-3">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">کتابخانه تصاویر</h2>
              <span className="text-sm text-app-muted">{assets.length} فایل</span>
            </div>

            {loading ? <p className="text-sm text-app-muted">در حال دریافت...</p> : null}
            {!loading && assets.length === 0 ? <p className="text-sm text-app-muted">هنوز تصویری آپلود نشده است.</p> : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {assets.map((asset) => {
                const previewUrl = mediaPreviewUrls[asset.id];
                return (
                  <div key={asset.id} className="overflow-hidden rounded-2xl border border-app-border bg-white shadow-sm">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={asset.original_filename}
                        className="aspect-video w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-video w-full items-center justify-center bg-slate-50 text-xs text-app-muted">
                        پیش‌نمایش در دسترس نیست
                      </div>
                    )}
                    <div className="p-4">
                      <p className="truncate font-bold" title={asset.original_filename}>{asset.original_filename}</p>
                      <p className="mt-1 text-xs text-app-muted">{asset.content_type} · {formatSize(asset.size_bytes)}</p>
                      <p className="mt-1 text-xs text-app-muted">{asset.post_id ? `متصل به پست ${asset.post_id}` : "بدون اتصال"}</p>
                      <label className="mt-4 block text-xs font-semibold text-app-muted">
                        اتصال به پست
                        <select
                          value={asset.post_id ?? ""}
                          onChange={(event) => attachToPost(asset.id, event.target.value)}
                          className="mt-2 w-full rounded-xl border border-app-border bg-white px-3 py-2 text-sm text-app-text"
                        >
                          <option value="">بدون اتصال</option>
                          {posts.map((post) => (
                            <option key={post.id} value={post.id}>{post.title}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </AppShell>
    </AuthGate>
  );
}

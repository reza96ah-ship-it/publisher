"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "../../components/auth-gate";
import { AppShell } from "../../components/app-shell";
import { PageHeader } from "../../components/page-header";
import { StatusBadge } from "../../components/status-badge";
import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/card";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Post = {
  id: number;
  title: string;
  caption: string;
  hashtags: string;
  platform: string;
  status: string;
};

type MediaAsset = {
  id: number;
  post_id: number | null;
  original_filename: string;
  content_type: string;
  size_bytes: number;
};

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function token() {
    return window.localStorage.getItem("rubika_publisher_access") ?? "";
  }

  async function loadData() {
    setLoading(true);
    const headers = { Authorization: `Bearer ${token()}` };
    const [postsResponse, mediaResponse] = await Promise.all([
      fetch(`${apiUrl}/posts`, { headers }),
      fetch(`${apiUrl}/media`, { headers })
    ]);

    if (postsResponse.ok) setPosts(await postsResponse.json());
    if (mediaResponse.ok) setMediaAssets(await mediaResponse.json());
    setLoading(false);
  }

  useEffect(() => {
    loadData().catch(() => {
      setError("خطا در دریافت اطلاعات پست‌ها");
      setLoading(false);
    });
  }, []);

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

  async function deletePost(id: number) {
    setMessage("");
    setError("");
    const response = await fetch(`${apiUrl}/posts/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token()}` }
    });

    if (!response.ok) {
      setError("حذف پست ناموفق بود");
      return;
    }

    setMessage("پست حذف شد");
    await loadData();
  }

  return (
    <AuthGate>
      <AppShell>
        <PageHeader
          eyebrow="Phase 3 — Post Management"
          title="مدیریت پست‌ها"
          description="این صفحه فقط برای مشاهده و مدیریت پست‌های موجود است. ایجاد پست جدید فقط از composer انجام می‌شود."
          actionLabel="ایجاد پست جدید"
          actionHref="/compose"
        />

        {message ? <div className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
        {error ? <div className="mb-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <SectionCard
          title="فهرست پست‌ها"
          description="فرم ایجاد پست از این صفحه حذف شده است. برای ساخت پست جدید از composer استفاده کنید."
          action={<Button href="/compose">ایجاد پست جدید</Button>}
        >
          {loading ? <p className="text-sm text-app-muted">در حال دریافت...</p> : null}
          {!loading && posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-app-border bg-slate-50 p-8 text-center">
              <p className="font-bold text-app-text">هنوز پستی ایجاد نشده است.</p>
              <p className="mt-2 text-sm text-app-muted">اولین پست را از composer بسازید.</p>
              <Button href="/compose" className="mt-4">رفتن به composer</Button>
            </div>
          ) : null}

          <div className="grid gap-3">
            {posts.map((post) => {
              const media = mediaAssets.find((asset) => asset.post_id === post.id);
              const thumbUrl = media ? mediaPreviewUrls[media.id] : "";
              return (
                <article key={post.id} className="rounded-2xl border border-app-border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      {thumbUrl ? (
                        <img src={thumbUrl} alt={media?.original_filename ?? "تصویر پست"} className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-app-border" />
                      ) : (
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xs text-app-muted ring-1 ring-app-border">بدون تصویر</div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-bold text-app-text">{post.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-7 text-app-muted">{post.caption || "بدون کپشن"}</p>
                        <p className="mt-1 text-xs text-app-muted">{media ? `تصویر: ${media.original_filename}` : "بدون تصویر"}</p>
                      </div>
                    </div>
                    <StatusBadge status={post.status} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-app-border pt-3">
                    <Button type="button" variant="secondary" size="sm" disabled>ویرایش در فاز بعدی</Button>
                    <Button type="button" variant="danger" size="sm" onClick={() => deletePost(post.id)}>حذف</Button>
                  </div>
                </article>
              );
            })}
          </div>
        </SectionCard>
      </AppShell>
    </AuthGate>
  );
}

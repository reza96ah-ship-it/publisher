"use client";

import { FormEvent, useEffect, useState } from "react";
import { AuthGate } from "../../components/auth-gate";
import { AppShell } from "../../components/app-shell";
import { PageHeader } from "../../components/page-header";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const emptyStore = {
  name: "",
  category: "",
  phone: "",
  description: "",
  default_hashtags: "",
  caption_footer: "",
  timezone: "Asia/Tehran"
};

export default function StorePage() {
  const [form, setForm] = useState(emptyStore);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStore() {
      const token = window.localStorage.getItem("rubika_publisher_access");
      if (!token) return;

      const response = await fetch(`${apiUrl}/stores/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data) {
          setForm({
            name: data.name ?? "",
            category: data.category ?? "",
            phone: data.phone ?? "",
            description: data.description ?? "",
            default_hashtags: data.default_hashtags ?? "",
            caption_footer: data.caption_footer ?? "",
            timezone: data.timezone ?? "Asia/Tehran"
          });
        }
      }

      setLoading(false);
    }

    loadStore().catch(() => {
      setError("خطا در دریافت اطلاعات فروشگاه");
      setLoading(false);
    });
  }, []);

  function updateField(field: keyof typeof emptyStore, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);

    try {
      const token = window.localStorage.getItem("rubika_publisher_access");
      const response = await fetch(`${apiUrl}/stores/active`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        throw new Error("ذخیره پروفایل فروشگاه ناموفق بود");
      }

      const data = await response.json();
      setForm({
        name: data.name ?? "",
        category: data.category ?? "",
        phone: data.phone ?? "",
        description: data.description ?? "",
        default_hashtags: data.default_hashtags ?? "",
        caption_footer: data.caption_footer ?? "",
        timezone: data.timezone ?? "Asia/Tehran"
      });
      setMessage("پروفایل فروشگاه ذخیره شد");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای ذخیره اطلاعات");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGate>
      <AppShell>
        <PageHeader
          eyebrow="Phase 04 — Store Profile"
          title="پروفایل فروشگاه"
          description="اطلاعات پایه فروشگاه برای کپشن، هشتگ‌های پیش‌فرض و اتصال‌های انتشار استفاده می‌شود."
        />

        <section className="rounded-2xl border border-app-border bg-app-surface p-6 shadow-soft">
          {loading ? (
            <p className="text-sm text-app-muted">در حال دریافت اطلاعات...</p>
          ) : (
            <form onSubmit={saveStore} className="grid gap-5 lg:grid-cols-2">
              <label className="block text-sm font-medium">
                نام فروشگاه
                <input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-app-border px-4 py-3 text-sm outline-none ring-app-primary focus:ring-2"
                  required
                />
              </label>

              <label className="block text-sm font-medium">
                دسته‌بندی فعالیت
                <input
                  value={form.category}
                  onChange={(event) => updateField("category", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-app-border px-4 py-3 text-sm outline-none ring-app-primary focus:ring-2"
                  placeholder="مثلاً پوشاک، کافه، آرایشی"
                />
              </label>

              <label className="block text-sm font-medium">
                شماره تماس
                <input
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-app-border px-4 py-3 text-left text-sm outline-none ring-app-primary focus:ring-2"
                  dir="ltr"
                />
              </label>

              <label className="block text-sm font-medium">
                منطقه زمانی
                <input
                  value={form.timezone}
                  onChange={(event) => updateField("timezone", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-app-border px-4 py-3 text-left text-sm outline-none ring-app-primary focus:ring-2"
                  dir="ltr"
                />
              </label>

              <label className="block text-sm font-medium lg:col-span-2">
                توضیحات کوتاه فروشگاه
                <textarea
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  className="mt-2 min-h-28 w-full rounded-xl border border-app-border px-4 py-3 text-sm leading-7 outline-none ring-app-primary focus:ring-2"
                />
              </label>

              <label className="block text-sm font-medium lg:col-span-2">
                هشتگ‌های پیش‌فرض
                <textarea
                  value={form.default_hashtags}
                  onChange={(event) => updateField("default_hashtags", event.target.value)}
                  className="mt-2 min-h-24 w-full rounded-xl border border-app-border px-4 py-3 text-sm leading-7 outline-none ring-app-primary focus:ring-2"
                  placeholder="#فروشگاه #خرید_آنلاین"
                />
              </label>

              <label className="block text-sm font-medium lg:col-span-2">
                متن پایانی کپشن
                <textarea
                  value={form.caption_footer}
                  onChange={(event) => updateField("caption_footer", event.target.value)}
                  className="mt-2 min-h-24 w-full rounded-xl border border-app-border px-4 py-3 text-sm leading-7 outline-none ring-app-primary focus:ring-2"
                  placeholder="برای سفارش پیام بدهید."
                />
              </label>

              {message ? <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 lg:col-span-2">{message}</div> : null}
              {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 lg:col-span-2">{error}</div> : null}

              <div className="lg:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-app-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-app-primaryHover disabled:opacity-60"
                >
                  {saving ? "در حال ذخیره..." : "ذخیره پروفایل فروشگاه"}
                </button>
              </div>
            </form>
          )}
        </section>
      </AppShell>
    </AuthGate>
  );
}

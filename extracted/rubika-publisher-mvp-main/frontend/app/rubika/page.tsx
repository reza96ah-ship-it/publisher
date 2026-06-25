"use client";

import { FormEvent, useEffect, useState } from "react";
import { AuthGate } from "../../components/auth-gate";
import { AppShell } from "../../components/app-shell";
import { PageHeader } from "../../components/page-header";
import { StatusBadge } from "../../components/status-badge";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function RubikaPage() {
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [maskedToken, setMaskedToken] = useState("");
  const [botName, setBotName] = useState("");
  const [status, setStatus] = useState("not_tested");
  const [lastError, setLastError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSettings() {
      const token = window.localStorage.getItem("rubika_publisher_access");
      if (!token) return;

      const response = await fetch(`${apiUrl}/rubika/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data) {
          setChatId(data.chat_id ?? "");
          setMaskedToken(data.bot_token_masked ?? "");
          setBotName(data.bot_name ?? "");
          setStatus(data.status ?? "not_tested");
          setLastError(data.last_error ?? "");
        }
      }
      setLoading(false);
    }

    loadSettings().catch(() => {
      setError("خطا در دریافت تنظیمات روبیکا");
      setLoading(false);
    });
  }, []);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);

    try {
      const token = window.localStorage.getItem("rubika_publisher_access");
      const response = await fetch(`${apiUrl}/rubika/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ bot_token: botToken, chat_id: chatId })
      });

      if (!response.ok) throw new Error("ذخیره تنظیمات روبیکا ناموفق بود");
      const data = await response.json();
      setMaskedToken(data.bot_token_masked ?? "");
      setStatus(data.status ?? "not_tested");
      setLastError(data.last_error ?? "");
      setMessage("تنظیمات روبیکا ذخیره شد");
      setBotToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای ذخیره تنظیمات");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setMessage("");
    setError("");
    setTesting(true);

    try {
      const token = window.localStorage.getItem("rubika_publisher_access");
      const response = await fetch(`${apiUrl}/rubika/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      setStatus(data.status ?? "failed");
      setBotName(data.bot_name ?? "");
      setLastError(data.error ?? "");
      if (data.ok) setMessage("اتصال روبیکا موفق بود");
      else setError(data.error || "تست اتصال ناموفق بود");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای تست اتصال");
    } finally {
      setTesting(false);
    }
  }

  return (
    <AuthGate>
      <AppShell>
        <PageHeader
          eyebrow="Phase 05 — Rubika Connection"
          title="اتصال روبیکا"
          description="توکن ربات و شناسه مقصد را وارد کنید، سپس اتصال را تست کنید. در فاز انتشار، همین اتصال برای ارسال خودکار پست استفاده می‌شود."
        />

        <section className="grid gap-5 lg:grid-cols-3">
          <form onSubmit={saveSettings} className="rounded-2xl border border-app-border bg-app-surface p-6 shadow-soft lg:col-span-2">
            {loading ? (
              <p className="text-sm text-app-muted">در حال دریافت تنظیمات...</p>
            ) : (
              <div className="space-y-5">
                <label className="block text-sm font-medium">
                  توکن ربات روبیکا
                  <input
                    value={botToken}
                    onChange={(event) => setBotToken(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-app-border px-4 py-3 text-left text-sm outline-none ring-app-primary focus:ring-2"
                    dir="ltr"
                    placeholder={maskedToken || "توکن ربات را وارد کنید"}
                    required={!maskedToken}
                  />
                </label>

                <label className="block text-sm font-medium">
                  Chat ID / Channel ID
                  <input
                    value={chatId}
                    onChange={(event) => setChatId(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-app-border px-4 py-3 text-left text-sm outline-none ring-app-primary focus:ring-2"
                    dir="ltr"
                    required
                  />
                </label>

                {maskedToken ? <p className="text-xs text-app-muted">توکن ذخیره‌شده: {maskedToken}</p> : null}
                {message ? <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
                {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-app-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-app-primaryHover disabled:opacity-60"
                  >
                    {saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
                  </button>
                  <button
                    type="button"
                    onClick={testConnection}
                    disabled={testing || !maskedToken}
                    className="rounded-xl border border-app-border bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    {testing ? "در حال تست..." : "تست اتصال"}
                  </button>
                </div>
              </div>
            )}
          </form>

          <aside className="rounded-2xl border border-app-border bg-app-surface p-6 shadow-sm">
            <h2 className="text-lg font-bold">وضعیت اتصال</h2>
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-app-muted">وضعیت</span>
                <StatusBadge status={status === "connected" ? "published" : status === "failed" ? "failed" : "draft"} />
              </div>
              <div>
                <p className="text-app-muted">نام ربات</p>
                <p className="mt-1 font-semibold">{botName || "ثبت نشده"}</p>
              </div>
              <div>
                <p className="text-app-muted">مقصد</p>
                <p className="mt-1 break-all text-left font-mono text-xs" dir="ltr">{chatId || "-"}</p>
              </div>
              {lastError ? (
                <div className="rounded-xl bg-rose-50 p-3 text-xs leading-6 text-rose-700">{lastError}</div>
              ) : null}
            </div>
          </aside>
        </section>
      </AppShell>
    </AuthGate>
  );
}

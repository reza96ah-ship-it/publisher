"use client";

import { BadgeCheck, ExternalLink, Instagram, KeyRound, PlugZap, RefreshCw, Route, Save, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "../../components/app-shell";
import { AuthGate } from "../../components/auth-gate";
import { InstagramAutomationPanel } from "../../components/instagram-automation-panel";
import { LoadingPanel } from "../../components/loading-skeleton";
import { useToast } from "../../components/toast-provider";
import { Button } from "../../components/ui/button";
import { Field, Input, Textarea } from "../../components/ui/form";
import { DetailGrid, NoticeBanner, StatusToken, WorkspacePage, WorkspacePanel } from "../../components/workspace-ui";
import { apiUrl, authHeaders } from "../../lib/posts";
import { notifyWorkspaceUpdated } from "../../lib/workspace";

type InstagramSettings = {
  id: number;
  store_id: number;
  username: string;
  account_type: string;
  publish_mode: string;
  professional_account_id: string;
  page_id: string;
  has_access_token: boolean;
  access_token_masked: string;
  token_expires_at: string | null;
  status: string;
  permissions: string;
  last_error: string;
  last_test_at: string | null;
  is_active: boolean;
};

type InstagramOAuthStart = {
  configured: boolean;
  authorization_url: string;
  redirect_uri: string;
  scopes: string[];
  missing: string[];
  expires_in_minutes: number;
};

const DEFAULT_INSTAGRAM_PERMISSIONS = "instagram_basic, instagram_content_publish, instagram_manage_comments, instagram_manage_messages, pages_show_list, pages_read_engagement";

function statusLabel(status: string) {
  if (status === "connected") return "اتصال تایید شده";
  if (status === "reminder_ready") return "آماده یادآوری دستی";
  if (status === "oauth_required") return "نیازمند Meta OAuth";
  if (status === "failed") return "اتصال خطا دارد";
  return "در حال آماده‌سازی";
}

function statusTone(status: string): "success" | "warning" | "alert" | "neutral" {
  if (status === "connected") return "success";
  if (status === "reminder_ready") return "success";
  if (status === "failed") return "alert";
  if (status === "oauth_required") return "warning";
  return "neutral";
}

function formatDateTime(value?: string | null) {
  if (!value) return "هنوز اجرا نشده";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "زمان نامعتبر";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function InstagramPage() {
  const { showToast } = useToast();
  const [username, setUsername] = useState("");
  const [accountType, setAccountType] = useState<"personal" | "creator" | "business">("creator");
  const [professionalAccountId, setProfessionalAccountId] = useState("");
  const [pageId, setPageId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [permissions, setPermissions] = useState(DEFAULT_INSTAGRAM_PERMISSIONS);
  const [saved, setSaved] = useState<InstagramSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [oauth, setOauth] = useState<InstagramOAuthStart | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get("instagram_oauth");
    const oauthMessage = params.get("message");
    if (oauthStatus === "success") {
      const description = oauthMessage || "اتصال Meta با موفقیت کامل شد.";
      setMessage(description);
      showToast({ title: "اینستاگرام متصل شد", description, tone: "success" });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (oauthStatus === "error") {
      const description = oauthMessage || "اتصال Meta کامل نشد.";
      setError(description);
      showToast({ title: "اتصال Meta ناموفق بود", description, tone: "alert" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [showToast]);

  useEffect(() => {
    async function loadSettings() {
      const response = await fetch(`${apiUrl}/instagram/settings`, { headers: authHeaders() });
      if (!response.ok) throw new Error("دریافت تنظیمات اینستاگرام ناموفق بود");
      const data = await response.json();
      if (data) {
        setSaved(data);
        setUsername(data.username ?? "");
        setAccountType(data.account_type ?? "creator");
        setProfessionalAccountId(data.professional_account_id ?? "");
        setPageId(data.page_id ?? "");
        setAccessToken("");
        setPermissions(data.permissions || DEFAULT_INSTAGRAM_PERMISSIONS);
      }
      setLoading(false);
    }

    loadSettings().catch((err) => {
      setError(err instanceof Error ? err.message : "خطا در دریافت تنظیمات اینستاگرام");
      setLoading(false);
    });
    loadOAuthStart();
  }, []);

  const dirty = useMemo(() => {
    if (!saved) return Boolean(username || professionalAccountId || pageId || permissions);
    return username !== saved.username
      || accountType !== saved.account_type
      || professionalAccountId !== saved.professional_account_id
      || pageId !== saved.page_id
      || Boolean(accessToken.trim())
      || permissions !== saved.permissions;
  }, [accessToken, accountType, pageId, permissions, professionalAccountId, saved, username]);
  const status = dirty ? "draft" : saved?.status ?? "not_configured";
  const publishMode = accountType === "personal" ? "reminder" : "direct";
  const hasIdentity = Boolean(username.trim() || professionalAccountId.trim() || pageId.trim());
  const readiness = [
    { label: accountType === "personal" ? "اکانت معمولی" : "حساب حرفه‌ای", detail: hasIdentity ? "نام کاربری یا شناسه حساب ثبت شده است." : "نام کاربری یا شناسه کانال را مشخص کنید.", done: hasIdentity, icon: Instagram },
    { label: accountType === "personal" ? "یادآوری دستی" : "مجوزهای Meta", detail: accountType === "personal" ? "برای اکانت معمولی، انتشار مستقیم غیرفعال و یادآوری دستی فعال می‌شود." : permissions.trim() ? "لیست مجوزهای موردنیاز مستند شده است." : "مجوزهای Meta Graph را مشخص کنید.", done: accountType === "personal" || Boolean(permissions.trim()), icon: ShieldCheck },
    { label: accountType === "personal" ? "قابل زمان‌بندی" : "OAuth واقعی", detail: accountType === "personal" ? "پست در زمان مقرر به وضعیت آماده انتشار دستی می‌رسد." : saved?.status === "connected" ? "توکن معتبر متصل است." : "در فاز بعدی باید جریان OAuth و refresh token اضافه شود.", done: accountType === "personal" || saved?.status === "connected", icon: KeyRound }
  ];
  const readyCount = readiness.filter((item) => item.done).length;

  async function loadOAuthStart() {
    setOauthLoading(true);
    try {
      const response = await fetch(`${apiUrl}/instagram/oauth/start`, { headers: authHeaders() });
      if (!response.ok) throw new Error("Meta OAuth status failed to load");
      const data = (await response.json()) as InstagramOAuthStart;
      setOauth(data);
    } catch {
      setOauth(null);
    } finally {
      setOauthLoading(false);
    }
  }

  async function connectWithMeta() {
    setError("");
    setMessage("");
    setOauthLoading(true);
    try {
      const response = await fetch(`${apiUrl}/instagram/oauth/start`, { headers: authHeaders() });
      if (!response.ok) throw new Error("شروع اتصال Meta ناموفق بود");
      const data = (await response.json()) as InstagramOAuthStart;
      setOauth(data);
      if (!data.configured || !data.authorization_url) {
        throw new Error(data.missing.length ? `تنظیمات Meta کامل نیست: ${data.missing.join(", ")}` : "Meta OAuth هنوز پیکربندی نشده است");
      }
      window.location.href = data.authorization_url;
    } catch (err) {
      const nextError = err instanceof Error ? err.message : "خطای شروع اتصال Meta";
      setError(nextError);
      showToast({ title: "شروع اتصال Meta ناموفق بود", description: nextError, tone: "alert" });
      setOauthLoading(false);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`${apiUrl}/instagram/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          username: username.trim(),
          account_type: accountType,
          publish_mode: publishMode,
          professional_account_id: professionalAccountId.trim(),
          page_id: pageId.trim(),
          access_token: accessToken.trim(),
          permissions: permissions.trim()
        })
      });
      if (!response.ok) throw new Error("ذخیره تنظیمات اینستاگرام ناموفق بود");
      const data = (await response.json()) as InstagramSettings;
      setSaved(data);
      setAccessToken("");
      setMessage(accountType === "personal" ? "اکانت معمولی برای یادآوری انتشار دستی آماده شد" : "پروفایل اینستاگرام برای فاز اتصال واقعی آماده شد");
      showToast({ title: "تنظیمات اینستاگرام ذخیره شد", description: accountType === "personal" ? "زمان‌بندی دستی برای اکانت معمولی فعال شد." : "زمان‌بندی مستقیم بعد از Meta OAuth فعال می‌شود.", tone: "success" });
      notifyWorkspaceUpdated();
    } catch (err) {
      const nextError = err instanceof Error ? err.message : "خطای ذخیره تنظیمات";
      setError(nextError);
      showToast({ title: "ذخیره اینستاگرام ناموفق بود", description: nextError, tone: "alert" });
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`${apiUrl}/instagram/test`, { method: "POST", headers: authHeaders() });
      const data = await response.json();
      setSaved((current) => current ? { ...current, status: data.status, last_error: data.error, last_test_at: data.last_test_at } : current);
      if (data.ok) {
        setMessage(data.error || "اکانت معمولی برای یادآوری دستی آماده است");
        showToast({ title: "حالت یادآوری فعال است", description: "پست‌ها در زمان مقرر برای انتشار دستی آماده می‌شوند.", tone: "success" });
      } else {
        setError(data.error || "Meta OAuth هنوز متصل نیست");
        showToast({ title: "اتصال اینستاگرام هنوز کامل نیست", description: "برای انتشار مستقیم باید Meta OAuth و مجوزهای انتشار اضافه شود.", tone: "warning" });
      }
      notifyWorkspaceUpdated();
    } catch (err) {
      const nextError = err instanceof Error ? err.message : "خطای تست اتصال اینستاگرام";
      setError(nextError);
      showToast({ title: "تست اینستاگرام ناموفق بود", description: nextError, tone: "alert" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <AuthGate>
      <AppShell>
        <WorkspacePage className="space-y-4">
          <section className="app-studio-panel rounded-lg px-4 py-3">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div>
                <p className="text-[10px] font-black text-app-primary">تنظیمات کانال</p>
                <h1 className="mt-1 text-xl font-black text-app-text">اتصال اینستاگرام</h1>
                <p className="mt-1 text-xs leading-5 text-app-muted">اکانت معمولی با یادآوری دستی کار می‌کند؛ Creator و Business بعد از Meta OAuth انتشار مستقیم می‌گیرند.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusToken tone={dirty ? "warning" : statusTone(status)}>{dirty ? "تغییرات ذخیره نشده" : statusLabel(status)}</StatusToken>
                <StatusToken tone={readyCount === 3 ? "success" : "warning"}>{readyCount}/3 آماده</StatusToken>
                <Button type="button" variant="secondary" size="sm" disabled={testing || dirty} onClick={testConnection}>
                  <RefreshCw className={`ml-2 h-4 w-4 ${testing ? "animate-spin" : ""}`} aria-hidden="true" />
                  تست اتصال
                </Button>
              </div>
            </div>
          </section>

          {loading ? <LoadingPanel /> : null}
          {message ? <NoticeBanner tone="success" title="انجام شد">{message}</NoticeBanner> : null}
          {error ? <NoticeBanner tone="warning" title="وضعیت اتصال">{error}</NoticeBanner> : null}

          {!loading ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              <WorkspacePanel title="پروفایل کانال" description="اطلاعاتی که در فاز OAuth برای اتصال به حساب حرفه‌ای Meta لازم می‌شود.">
                <form onSubmit={saveSettings} className="grid gap-4">
                  <section className="grid gap-2 rounded-md border border-app-border bg-app-surfaceMuted p-3 sm:grid-cols-3">
                    {[
                      { value: "personal", label: "معمولی", detail: "یادآوری دستی، بدون انتشار خودکار" },
                      { value: "creator", label: "Creator", detail: "انتشار مستقیم بعد از Meta OAuth" },
                      { value: "business", label: "Business", detail: "انتشار مستقیم بعد از اتصال Page" }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setAccountType(option.value as "personal" | "creator" | "business")}
                        className={`app-interactive rounded-md border px-3 py-3 text-right ${
                          accountType === option.value ? "border-blue-200 bg-white text-app-primary shadow-soft" : "border-app-border bg-white/70 text-app-text hover:bg-white"
                        }`}
                        aria-pressed={accountType === option.value}
                      >
                        <span className="block text-sm font-black">{option.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-app-muted">{option.detail}</span>
                      </button>
                    ))}
                  </section>

                  <Field label="نام کاربری اینستاگرام" hint="مثلاً brand_shop">
                    <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="instagram_username" />
                  </Field>
                  {accountType !== "personal" ? (
                    <>
                      <section className="rounded-md border border-app-border bg-white/75 p-3 shadow-hairline">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                                <PlugZap className="h-4 w-4" aria-hidden="true" />
                              </span>
                              <div>
                                <p className="text-sm font-black text-app-text">اتصال امن Meta</p>
                                <p className="mt-1 text-xs leading-5 text-app-muted">ورود رسمی Meta، دریافت Page token و شناسایی Instagram Professional Account.</p>
                              </div>
                            </div>
                            {oauth?.configured ? (
                              <p className="mt-3 text-[11px] leading-5 text-app-muted" dir="ltr">Redirect URI: {oauth.redirect_uri}</p>
                            ) : (
                              <p className="mt-3 text-[11px] leading-5 text-amber-700">برای فعال شدن، این envها لازم است: {oauth?.missing?.join(", ") || "META_APP_ID, META_APP_SECRET"}</p>
                            )}
                          </div>
                          <Button type="button" variant={saved?.status === "connected" ? "secondary" : "primary"} size="sm" onClick={connectWithMeta} disabled={oauthLoading}>
                            <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                            {oauthLoading ? "بررسی..." : saved?.status === "connected" ? "اتصال دوباره" : "اتصال با Meta"}
                          </Button>
                        </div>
                      </section>
                      <Field label="Instagram Professional Account ID" hint="بعد از OAuth به صورت خودکار قابل دریافت است.">
                        <Input value={professionalAccountId} onChange={(event) => setProfessionalAccountId(event.target.value)} placeholder="1784..." dir="ltr" />
                      </Field>
                      <Field label="Facebook Page ID" hint="برای Graph API انتشار محتوا به Page linkage نیاز است.">
                        <Input value={pageId} onChange={(event) => setPageId(event.target.value)} placeholder="page_id" dir="ltr" />
                      </Field>
                      <Field label="Meta Page Access Token" hint={saved?.has_access_token ? `توکن ذخیره شده: ${saved.access_token_masked}` : "فقط برای توسعه؛ مسیر اصلی از دکمه اتصال امن Meta است."}>
                        <Input value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder={saved?.has_access_token ? "برای تغییر، توکن جدید را وارد کنید" : "EAAB..."} dir="ltr" type="password" autoComplete="off" />
                      </Field>
                      <Field label="مجوزهای موردنیاز" hint="در فاز OAuth به scopeهای Meta تبدیل می‌شود.">
                        <Textarea value={permissions} onChange={(event) => setPermissions(event.target.value)} className="min-h-24" dir="ltr" />
                      </Field>
                    </>
                  ) : (
                    <NoticeBanner tone="info" title="حالت اکانت معمولی">
                      این حالت پست را خودکار منتشر نمی‌کند. در زمان مقرر، پست به وضعیت آماده انتشار دستی می‌رسد تا کپشن را کپی کنید و در Instagram منتشر کنید.
                    </NoticeBanner>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={saving}>
                      <Save className="ml-2 h-4 w-4" aria-hidden="true" />
                      {saving ? "در حال ذخیره" : "ذخیره تنظیمات"}
                    </Button>
                    <Button href="/compose" variant="secondary">رفتن به composer</Button>
                  </div>
                </form>
              </WorkspacePanel>

              <InstagramAutomationPanel accountType={accountType} channelStatus={saved?.status ?? status} />

              <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
                <WorkspacePanel title={accountType === "personal" ? "مسیر اکانت معمولی" : "مسیر اتصال واقعی"} description={accountType === "personal" ? "بدون پسورد و بدون اتوماسیون ناامن؛ فقط یادآوری و آماده‌سازی دستی." : "این فاز عمداً توکن جعلی ذخیره نمی‌کند."} action={<StatusToken tone={accountType === "personal" ? "success" : "warning"}>{accountType === "personal" ? "Reminder mode" : "OAuth pending"}</StatusToken>}>
                  <div className="space-y-3">
                    {readiness.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="flex items-start gap-3 rounded-md border border-app-border bg-white p-3">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${item.done ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"}`}>
                            {item.done ? <BadgeCheck className="h-4 w-4" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
                          </span>
                          <div>
                            <p className="text-sm font-black text-app-text">{item.label}</p>
                            <p className="mt-1 text-xs leading-5 text-app-muted">{item.detail}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </WorkspacePanel>

                <WorkspacePanel title="قرارداد انتشار" description={accountType === "personal" ? "اکانت معمولی فقط یادآوری دستی می‌گیرد." : "قبل از اتصال واقعی، انتشار مستقیم اینستاگرام مسدود می‌ماند."}>
                  <DetailGrid
                    items={[
                      { label: "وضعیت", value: statusLabel(status), hint: "وضعیت آماده‌سازی کانال" },
                      { label: "آخرین تست", value: formatDateTime(saved?.last_test_at), hint: "تست فعلی فقط OAuth pending را گزارش می‌کند" },
                      { label: "نوع حساب", value: accountType === "personal" ? "معمولی" : accountType === "creator" ? "Creator" : "Business", hint: accountType === "personal" ? "یادآوری دستی" : "انتشار مستقیم بعد از OAuth" },
                      { label: "پشتیبانی فعلی", value: accountType === "personal" ? "زمان‌بندی یادآوری" : "پیش‌نویس و انتخاب کانال", hint: accountType === "personal" ? "بدون auto-publish" : "زمان‌بندی مستقیم بعد از OAuth" },
                      { label: "مسیر بعدی", value: accountType === "personal" ? "Push reminder + copy flow" : "Meta OAuth + publisher adapter", hint: accountType === "personal" ? "تجربه دستی حرفه‌ای" : "Graph API content publishing" }
                    ]}
                  />
                  <NoticeBanner tone="info" title="گام بعدی فنی">
                    {accountType === "personal" ? "برای اکانت معمولی باید push reminder، copy caption و open Instagram flow را کامل کنیم." : "باید flow ورود Meta، ذخیره refresh token، بررسی مجوزها و adapter انتشار Instagram اضافه شود."}
                  </NoticeBanner>
                  <Button href="/queue" variant="secondary" className="mt-4 w-full">
                    <Route className="ml-2 h-4 w-4" aria-hidden="true" />
                    مشاهده صف انتشار
                  </Button>
                </WorkspacePanel>

                <NoticeBanner tone={accountType === "personal" ? "success" : "warning"} title="توجه">
                  {accountType === "personal" ? "اکانت معمولی می‌تواند زمان‌بندی شود، اما انتشار نهایی دستی است." : "انتخاب اینستاگرام در composer برای آماده‌سازی محتوا فعال است، اما زمان‌بندی مستقیم آن تا اتصال واقعی Meta مسدود می‌شود."}
                </NoticeBanner>
              </aside>
            </div>
          ) : null}
        </WorkspacePage>
      </AppShell>
    </AuthGate>
  );
}


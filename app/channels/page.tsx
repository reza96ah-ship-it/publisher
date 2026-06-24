"use client";

import { AlertTriangle, BadgeCheck, Clock3, Instagram, Network, RadioTower, Send, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../../components/app-shell";
import { AuthGate } from "../../components/auth-gate";
import { LoadingPanel } from "../../components/loading-skeleton";
import { Button } from "../../components/ui/button";
import { DetailGrid, NoticeBanner, StatusToken, WorkspacePage, WorkspacePanel } from "../../components/workspace-ui";
import { apiUrl, authHeaders } from "../../lib/posts";

type ChannelAccount = {
  id: number;
  store_id: number;
  channel: string;
  display_name: string;
  external_account_id: string;
  mode: string;
  status: string;
  capabilities: string[];
  limitations: string[];
  last_error: string;
  last_test_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ChannelAccountList = {
  accounts: ChannelAccount[];
  summary: {
    total: number;
    ready: number;
    action_required: number;
    channels: string[];
  };
};

type ChannelCapability = {
  label: string;
  rubika: "yes" | "partial" | "no";
  instagram: "yes" | "partial" | "no";
};

const capabilities: ChannelCapability[] = [
  { label: "زمان‌بندی محتوا", rubika: "yes", instagram: "partial" },
  { label: "انتشار خودکار", rubika: "yes", instagram: "partial" },
  { label: "انتشار دستی حرفه‌ای", rubika: "no", instagram: "yes" },
  { label: "ثبت تلاش انتشار", rubika: "yes", instagram: "yes" },
  { label: "بازیابی خطا", rubika: "yes", instagram: "partial" },
  { label: "تحلیل عملکرد واقعی", rubika: "partial", instagram: "partial" }
];

function formatDateTime(value?: string | null) {
  if (!value) return "ثبت نشده";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "زمان نامعتبر";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function channelStatusLabel(account?: ChannelAccount) {
  if (!account) return "تنظیم نشده";
  if (account.status === "ready") return "آماده";
  if (account.status === "test_expired") return "تست منقضی شده";
  if (account.status === "oauth_required") return "نیازمند Meta OAuth";
  if (account.status === "not_configured") return "تنظیم نشده";
  if (account.status === "failed") return "خطا دارد";
  return account.status;
}

function capabilityToken(value: "yes" | "partial" | "no") {
  if (value === "yes") return <StatusToken tone="success">فعال</StatusToken>;
  if (value === "partial") return <StatusToken tone="warning">مشروط</StatusToken>;
  return <StatusToken tone="neutral">ندارد</StatusToken>;
}

export default function ChannelsPage() {
  const [channelData, setChannelData] = useState<ChannelAccountList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadChannels() {
      setLoading(true);
      setError("");
      const headers = authHeaders();
      const response = await fetch(`${apiUrl}/channels/accounts`, { headers });
      if (!response.ok) throw new Error("دریافت مرکز کانال‌ها ناموفق بود");
      setChannelData(await response.json());
      setLoading(false);
    }

    loadChannels().catch((err) => {
      setError(err instanceof Error ? err.message : "دریافت وضعیت کانال‌ها ناموفق بود");
      setLoading(false);
    });
  }, []);

  const accounts = channelData?.accounts ?? [];
  const rubika = accounts.find((account) => account.channel === "rubika");
  const instagram = accounts.find((account) => account.channel === "instagram");
  const rubikaReady = rubika?.status === "ready";
  const instagramIsReady = instagram?.status === "ready";
  const readyCount = channelData?.summary.ready ?? 0;
  const channelCards = useMemo(() => [
    {
      key: "rubika",
      title: "روبیکا",
      description: "کانال انتشار خودکار با worker و تست سلامت 24 ساعته.",
      href: "/rubika",
      icon: Send,
      status: channelStatusLabel(rubika),
      tone: rubikaReady ? "success" as const : "warning" as const,
      mode: rubika?.mode ?? "disconnected",
      primaryAction: rubikaReady ? "مشاهده تنظیمات" : "تکمیل اتصال",
      facts: [
        { label: "نام نمایشی", value: rubika?.display_name || "روبیکا" },
        { label: "شناسه کانال", value: rubika?.external_account_id || "ثبت نشده" },
        { label: "آخرین تست", value: formatDateTime(rubika?.last_test_at) },
        { label: "قابلیت‌ها", value: rubika?.capabilities.length ? `${rubika.capabilities.length} قابلیت` : "نیازمند تنظیم" }
      ]
    },
    {
      key: "instagram",
      title: "اینستاگرام",
      description: "اکانت معمولی با کار دستی؛ حساب حرفه‌ای بعد از Meta OAuth می‌تواند API publishing بگیرد.",
      href: "/instagram",
      icon: Instagram,
      status: channelStatusLabel(instagram),
      tone: instagramIsReady ? "success" as const : "warning" as const,
      mode: instagram?.mode ?? "disconnected",
      primaryAction: instagramIsReady ? "مشاهده تنظیمات" : "انتخاب حالت حساب",
      facts: [
        { label: "نام نمایشی", value: instagram?.display_name || "اینستاگرام" },
        { label: "شناسه حساب", value: instagram?.external_account_id || "ثبت نشده" },
        { label: "حالت انتشار", value: instagram?.mode === "instagram_personal_manual" ? "یادآوری دستی" : instagram?.mode === "instagram_professional_api" ? "Meta API" : "تنظیم نشده" },
        { label: "آخرین تست", value: formatDateTime(instagram?.last_test_at) }
      ]
    }
  ], [instagram, instagramIsReady, rubika, rubikaReady]);

  return (
    <AuthGate>
      <AppShell>
        <WorkspacePage className="space-y-4">
          <section className="app-studio-panel rounded-lg px-4 py-4">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div>
                <p className="text-[10px] font-black text-app-primary">Channels Hub</p>
                <h1 className="mt-1 text-2xl font-black text-app-text">مرکز کانال‌های انتشار</h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-app-muted">
                  روبیکا و اینستاگرام از اینجا به عنوان کانال‌های مستقل مدیریت می‌شوند؛ هر کانال وضعیت، قابلیت، محدودیت و مسیر بازیابی خودش را دارد.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusToken tone={readyCount ? "success" : "warning"}>{readyCount}/2 کانال آماده</StatusToken>
                <StatusToken tone="neutral">Rubika + Instagram</StatusToken>
                <Button href="/compose" size="sm">ساخت محتوای چندکاناله</Button>
              </div>
            </div>
          </section>

          {error ? <NoticeBanner tone="alert">{error}</NoticeBanner> : null}
          {loading ? <LoadingPanel /> : null}

          {!loading ? (
            <>
              <section className="grid gap-4 lg:grid-cols-2">
                {channelCards.map((channel) => {
                  const Icon = channel.icon;
                  return (
                    <WorkspacePanel
                      key={channel.key}
                      title={channel.title}
                      description={channel.description}
                      action={<StatusToken tone={channel.tone}>{channel.status}</StatusToken>}
                      bodyClassName="p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${channel.tone === "success" ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"}`}>
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusToken tone="neutral">{channel.mode}</StatusToken>
                            {channel.tone === "success" ? <StatusToken tone="success">قابل استفاده</StatusToken> : <StatusToken tone="warning">نیازمند اقدام</StatusToken>}
                          </div>
                          <div className="mt-4">
                            <DetailGrid items={channel.facts} />
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button href={channel.href}>{channel.primaryAction}</Button>
                            <Button href="/queue" variant="secondary">صف انتشار</Button>
                          </div>
                        </div>
                      </div>
                    </WorkspacePanel>
                  );
                })}
              </section>

              <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <WorkspacePanel title="ماتریس قابلیت کانال‌ها" description="این جدول نشان می‌دهد هر کانال در وضعیت فعلی چه کاری را پشتیبانی می‌کند." bodyClassName="p-0">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-right text-sm">
                      <thead className="bg-app-surfaceMuted text-[11px] font-black text-app-muted">
                        <tr>
                          <th className="px-4 py-3">قابلیت</th>
                          <th className="px-4 py-3">روبیکا</th>
                          <th className="px-4 py-3">اینستاگرام</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-app-border">
                        {capabilities.map((capability) => (
                          <tr key={capability.label}>
                            <td className="px-4 py-3 font-bold text-app-text">{capability.label}</td>
                            <td className="px-4 py-3">{capabilityToken(capability.rubika)}</td>
                            <td className="px-4 py-3">{capabilityToken(capability.instagram)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </WorkspacePanel>

                <aside className="space-y-4">
                  <WorkspacePanel title="مسیر آماده‌سازی کانال‌ها" description="گام‌های لازم برای خروج از حالت MVP و ورود به مدیریت چندکاناله." bodyClassName="p-4">
                    <div className="space-y-3">
                      {[
                        { label: "روبیکا خودکار", detail: rubikaReady ? "تست اتصال معتبر است." : "توکن، مقصد و تست تازه لازم است.", done: rubikaReady, icon: RadioTower },
                        { label: "اینستاگرام دستی", detail: instagram?.mode === "instagram_personal_manual" && instagramIsReady ? "یادآوری دستی فعال است." : "برای اکانت معمولی حالت Manual reminder را فعال کنید.", done: instagram?.mode === "instagram_personal_manual" && instagramIsReady, icon: Clock3 },
                        { label: "مدل ChannelAccount", detail: "روبیکا و اینستاگرام از API مشترک کانال‌ها خوانده می‌شوند.", done: true, icon: Network },
                        { label: "انتشار قابل حسابرسی", detail: "هر کانال باید job، attempt و recovery مستقل داشته باشد.", done: false, icon: ShieldCheck }
                      ].map((step) => {
                        const Icon = step.done ? BadgeCheck : step.icon;
                        return (
                          <div key={step.label} className={`flex items-start gap-3 rounded-md border p-3 ${step.done ? "border-teal-100 bg-teal-50/60" : "border-app-border bg-white"}`}>
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${step.done ? "bg-white text-teal-700" : "bg-slate-50 text-app-muted"}`}>
                              <Icon className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div>
                              <p className="text-sm font-black text-app-text">{step.label}</p>
                              <p className="mt-1 text-xs leading-5 text-app-muted">{step.detail}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </WorkspacePanel>

                  <NoticeBanner tone={instagram?.mode === "instagram_personal_manual" ? "info" : "warning"} title="اصل مهم اینستاگرام">
                    اکانت معمولی اینستاگرام نباید به عنوان انتشار خودکار معرفی شود. در این محصول، اکانت معمولی مسیر دستی/یادآوری دارد و انتشار API فقط برای حساب‌های واجد شرایط Meta در فاز OAuth فعال می‌شود.
                  </NoticeBanner>

                  <WorkspacePanel title="اقدام بعدی پیشنهادی" description="بعد از مدل مشترک کانال، باید قابلیت‌ها وارد composer، queue و analytics شوند.">
                    <div className="grid gap-2">
                      <Button href="/rubika" variant="secondary">
                        <Send className="ml-2 h-4 w-4" aria-hidden="true" />
                        تنظیم روبیکا
                      </Button>
                      <Button href="/instagram" variant="secondary">
                        <Instagram className="ml-2 h-4 w-4" aria-hidden="true" />
                        تنظیم اینستاگرام
                      </Button>
                      <Button href="/queue" variant="secondary">
                        <AlertTriangle className="ml-2 h-4 w-4" aria-hidden="true" />
                        بررسی صف و وظایف دستی
                      </Button>
                    </div>
                  </WorkspacePanel>
                </aside>
              </section>
            </>
          ) : null}
        </WorkspacePage>
      </AppShell>
    </AuthGate>
  );
}

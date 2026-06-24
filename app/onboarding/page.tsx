"use client";

import { ArrowUpLeft, BadgeCheck, CalendarDays, CheckCircle2, CircleDashed, Network, PenLine, Rocket, Store, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../../components/app-shell";
import { AuthGate } from "../../components/auth-gate";
import { LoadingPanel } from "../../components/loading-skeleton";
import { Button } from "../../components/ui/button";
import { NoticeBanner, StatusToken, WorkspacePage, WorkspacePanel } from "../../components/workspace-ui";
import { buildCampaignFilterOptions, loadCampaigns, type Campaign } from "../../lib/campaigns";
import { apiUrl, authHeaders, type Post } from "../../lib/posts";
import { productName } from "../../lib/product";
import { isRubikaConnected, isStoreConfigured, loadWorkspaceOverview, type RubikaSettings, type StoreProfile } from "../../lib/workspace";

type SetupStep = {
  key: string;
  label: string;
  description: string;
  href: string;
  action: string;
  done: boolean;
  optional?: boolean;
  icon: typeof Store;
};

function hasScheduledPost(posts: Post[]) {
  return posts.some((post) => ["scheduled", "publishing", "published"].includes(post.status));
}

function StepRow({ step, active, index }: { step: SetupStep; active: boolean; index: number }) {
  const Icon = step.done ? BadgeCheck : step.icon;
  return (
    <article className={`app-row relative grid gap-3 px-4 py-4 lg:grid-cols-[44px_minmax(0,1fr)_132px] lg:items-center ${
      active ? "bg-amber-50/45" : step.done ? "bg-teal-50/30" : "bg-white"
    }`}>
      <span className={`absolute inset-y-3 right-0 w-0.5 rounded-full ${
        step.done ? "bg-app-teal" : active ? "bg-amber-500" : "bg-app-borderStrong"
      }`} aria-hidden="true" />
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-white shadow-hairline ${
        step.done ? "border-teal-100 text-teal-700" : active ? "border-amber-200 text-amber-700" : "border-app-border text-slate-500"
      }`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black text-slate-400">0{index + 1}</span>
          <h2 className="text-sm font-black text-app-text">{step.label}</h2>
          {step.optional ? <StatusToken tone="neutral">پیشنهادی</StatusToken> : null}
          {step.done ? <StatusToken tone="success">کامل</StatusToken> : active ? <StatusToken tone="warning">قدم فعلی</StatusToken> : <StatusToken tone="neutral">در انتظار</StatusToken>}
        </div>
        <p className="mt-1.5 text-xs leading-6 text-app-muted">{step.description}</p>
      </div>
      <Button href={step.href} variant={active ? "primary" : "secondary"} size="sm" className="w-full">
        {step.done ? "بازبینی" : step.action}
      </Button>
    </article>
  );
}

export default function OnboardingPage() {
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [rubika, setRubika] = useState<RubikaSettings | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSetup() {
      setLoading(true);
      setError("");
      const [overview, postResponse, campaignData] = await Promise.all([
        loadWorkspaceOverview(),
        fetch(`${apiUrl}/posts`, { headers: authHeaders() }),
        loadCampaigns()
      ]);
      if (!postResponse.ok) throw new Error("دریافت وضعیت راه‌اندازی ناموفق بود");
      setStore(overview.store);
      setRubika(overview.rubika);
      setPosts(await postResponse.json());
      setCampaigns(campaignData);
      setLoading(false);
    }

    loadSetup().catch((err) => {
      setError(err instanceof Error ? err.message : "خطا در دریافت مسیر راه‌اندازی");
      setLoading(false);
    });
  }, []);

  const campaignOptions = useMemo(() => buildCampaignFilterOptions(posts, campaigns), [campaigns, posts]);
  const steps: SetupStep[] = [
    {
      key: "brand",
      label: "هویت برند",
      description: "نام، دسته‌بندی، رنگ، لحن، CTA و تصویر برند را آماده کنید تا همه خروجی‌ها یکدست باشند.",
      href: "/store",
      action: "تکمیل برند",
      done: isStoreConfigured(store),
      icon: Store
    },
    {
      key: "channels",
      label: "کانال‌های انتشار",
      description: "روبیکا و اینستاگرام را به عنوان کانال‌های مستقل با وضعیت، قابلیت و محدودیت روشن تنظیم کنید.",
      href: "/channels",
      action: "تنظیم کانال‌ها",
      done: isRubikaConnected(rubika),
      icon: Network
    },
    {
      key: "campaign",
      label: "کمپین یا هدف انتشار",
      description: "برای انتشار حرفه‌ای، محتوا را به هدف، کمپین، مالک و بازه زمانی وصل کنید.",
      href: "/campaigns",
      action: "ساخت کمپین",
      done: campaigns.length > 0 || campaignOptions.some((option) => option.value !== "none"),
      optional: true,
      icon: Target
    },
    {
      key: "content",
      label: "اولین محتوای چندکاناله",
      description: "ایده، کپشن، رسانه، هشتگ و پیش‌نمایش را در composer آماده کنید.",
      href: "/compose",
      action: "ساخت محتوا",
      done: posts.length > 0,
      icon: PenLine
    },
    {
      key: "schedule",
      label: "زمان‌بندی و کنترل نهایی",
      description: "پست را وارد پلنر کنید و قبل از انتشار، وضعیت کانال، رسانه و فاصله زمانی را بررسی کنید.",
      href: "/calendar",
      action: "باز کردن پلنر",
      done: hasScheduledPost(posts),
      icon: CalendarDays
    }
  ];

  const completedCount = steps.filter((step) => step.done).length;
  const progress = Math.round((completedCount / steps.length) * 100);
  const nextStep = steps.find((step) => !step.done && !step.optional) ?? steps.find((step) => !step.done) ?? steps[steps.length - 1];

  return (
    <AuthGate>
      <AppShell>
        <WorkspacePage className="space-y-4">
          <section className="app-studio-panel overflow-hidden rounded-lg border-t-4 border-app-teal">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="px-4 py-5 lg:px-5">
                <p className="app-section-kicker text-[10px] font-black">راه‌اندازی هدایت‌شده</p>
                <h1 className="mt-2 text-2xl font-black text-app-text">راه‌اندازی {productName}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-app-muted">
                  این مسیر، ماژول‌های پراکنده را به یک سفر ساده تبدیل می‌کند: برند، کانال، کمپین، محتوا و زمان‌بندی.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button href={nextStep.href}>
                    <Rocket className="ml-2 h-4 w-4" aria-hidden="true" />
                    {nextStep.action}
                  </Button>
                  <Button href="/compose" variant="secondary">ساخت محتوا</Button>
                  <Button href="/calendar" variant="secondary">تقویم</Button>
                </div>
              </div>
              <div className="dashboard-pulse border-t border-app-border p-4 lg:border-r lg:border-t-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="dashboard-flow-node flex h-11 w-11 items-center justify-center rounded-full border-2 border-teal-100 bg-white text-app-teal">
                    {progress === 100 ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <CircleDashed className="h-5 w-5" aria-hidden="true" />}
                  </span>
                  <StatusToken tone={progress === 100 ? "success" : "warning"}>{completedCount}/{steps.length} کامل</StatusToken>
                </div>
                <p className="mt-4 text-xs font-black text-app-muted">پیشرفت راه‌اندازی</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white shadow-hairline">
                  <div className="app-progress h-full rounded-full bg-app-teal transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-3 text-sm font-black text-app-text">{progress}% آماده برای انتشار حرفه‌ای</p>
                <p className="mt-1 text-xs leading-5 text-app-muted">قدم بعدی: {nextStep.label}</p>
              </div>
            </div>
          </section>

          {error ? <NoticeBanner tone="alert">{error}</NoticeBanner> : null}
          {loading ? <LoadingPanel /> : null}

          {!loading ? (
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <WorkspacePanel
                title="مسیر حرفه‌ای‌سازی workspace"
                description="هر ردیف یک تصمیم عملیاتی است؛ وضعیت‌ها، اقدام بعدی و ترتیب کار در یک مسیر واحد دیده می‌شود."
                action={<StatusToken tone={progress === 100 ? "success" : "warning"}>{progress}% آماده</StatusToken>}
                bodyClassName="p-0"
              >
                <div className="divide-y divide-app-border">
                  {steps.map((step, index) => <StepRow key={step.key} step={step} active={step.key === nextStep.key} index={index} />)}
                </div>
              </WorkspacePanel>

              <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
                <section className="dashboard-live-monitor">
                  <div className="dashboard-monitor-head flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="app-section-kicker text-[10px] font-black">روز اول</p>
                      <h2 className="mt-1 text-sm font-black text-app-text">ترتیب پیشنهادی</h2>
                    </div>
                    <Rocket className="app-status-pulse h-4 w-4 text-app-teal" aria-hidden="true" />
                  </div>
                  <div className="divide-y divide-app-border/80">
                    {[
                      "برند را کامل کنید تا خروجی‌ها هویت واقعی داشته باشند.",
                      "کانال‌ها را بررسی کنید و محدودیت اینستاگرام معمولی را شفاف نگه دارید.",
                      "یک کمپین ساده بسازید یا مستقیم اولین پست را آماده کنید.",
                      "پست را زمان‌بندی کنید و از Calendar وضعیت نهایی را ببینید."
                    ].map((item, index) => (
                      <div key={item} className="flex items-start gap-3 px-4 py-3">
                        <span className="mt-0.5 text-[10px] font-black text-slate-400">0{index + 1}</span>
                        <p className="text-xs font-bold leading-6 text-app-muted">{item}</p>
                      </div>
                    ))}
                  </div>
                  <Button href={nextStep.href} variant="ghost" size="sm" className="w-full justify-between rounded-none border-t border-app-border bg-app-canvas/70 px-4 py-3 text-app-primary">
                    {nextStep.action}
                    <ArrowUpLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </section>

                <WorkspacePanel title="وضعیت فعلی" description="خلاصه داده‌های فعال workspace." bodyClassName="p-3">
                  <div className="grid gap-2">
                    {[
                      { label: "برند", value: isStoreConfigured(store) ? "آماده" : "ناقص", healthy: isStoreConfigured(store) },
                      { label: "کانال اصلی", value: isRubikaConnected(rubika) ? "آماده" : "نیازمند بررسی", healthy: isRubikaConnected(rubika) },
                      { label: "کمپین‌ها", value: String(campaigns.length), healthy: campaigns.length > 0 },
                      { label: "محتوا", value: String(posts.length), healthy: posts.length > 0 },
                      { label: "زمان‌بندی", value: hasScheduledPost(posts) ? "فعال" : "خالی", healthy: hasScheduledPost(posts) }
                    ].map((signal) => (
                      <div key={signal.label} className="flex items-center gap-3 rounded-md bg-app-surfaceMuted px-3 py-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${signal.healthy ? "bg-emerald-500" : "bg-amber-500"}`} />
                        <span className="min-w-0 flex-1 text-xs font-bold text-app-muted">{signal.label}</span>
                        <span className="truncate text-xs font-black text-app-text">{signal.value}</span>
                      </div>
                    ))}
                  </div>
                </WorkspacePanel>
              </aside>
            </section>
          ) : null}
        </WorkspacePage>
      </AppShell>
    </AuthGate>
  );
}

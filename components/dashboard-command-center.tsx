import { Activity, ArrowUpLeft, BellRing, CheckCircle2, CircleAlert, RadioTower, type LucideIcon } from "lucide-react";
import Link from "next/link";

export type DashboardFlowItem = {
  label: string;
  count: number;
  detail: string;
  href: string;
  icon: LucideIcon;
  tone: "primary" | "warning" | "info" | "alert";
};

export type DashboardSignal = {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  tone: "primary" | "warning" | "success" | "alert";
};

const flowToneClasses: Record<DashboardFlowItem["tone"], string> = {
  primary: "border-blue-200 bg-blue-50 text-app-primary",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  alert: "border-rose-200 bg-rose-50 text-rose-700"
};

const signalToneClasses: Record<DashboardSignal["tone"], string> = {
  primary: "text-app-primary",
  warning: "text-amber-700",
  success: "text-emerald-700",
  alert: "text-rose-700"
};

export function PublicationPulse({
  items,
  alertCount,
  unreadAlerts
}: {
  items: DashboardFlowItem[];
  alertCount: number;
  unreadAlerts: number;
}) {
  return (
    <section className="dashboard-pulse relative h-full overflow-hidden border-t border-app-border px-4 py-4 lg:border-r lg:border-t-0">
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <p className="app-section-kicker text-[10px] font-black">نبض انتشار</p>
          <h2 className="mt-2 text-sm font-black text-app-text">جریان زنده محتوا</h2>
          <p className="mt-1 text-[11px] leading-5 text-app-muted">وضعیت لحظه‌ای مسیر انتشار تا تحویل به کانال‌ها</p>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${alertCount ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {alertCount ? <CircleAlert className="h-4 w-4" aria-hidden="true" /> : <RadioTower className="app-status-pulse h-4 w-4" aria-hidden="true" />}
        </span>
      </div>

      <div className="relative z-10 mt-6">
        <span className="dashboard-flow-track absolute right-[9%] top-[18px] h-px w-[82%]" aria-hidden="true" />
        <div className="relative grid grid-cols-4 gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} className="app-interactive group flex min-w-0 flex-col items-center text-center">
                <span className={`dashboard-flow-node flex h-9 w-9 items-center justify-center rounded-full border-2 bg-white text-xs font-black ${flowToneClasses[item.tone]}`}>
                  {item.count}
                </span>
                <span className="mt-2 truncate text-[10px] font-black text-app-text">{item.label}</span>
                <Icon className={`mt-1 h-3.5 w-3.5 ${flowToneClasses[item.tone].split(" ").at(-1)}`} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </div>

      <Link href="/inbox" className="app-interactive relative z-10 mt-6 flex items-center justify-between gap-3 border-t border-app-border/80 pt-3">
        <span className="flex items-center gap-2 text-xs font-black text-app-text">
          <BellRing className="h-4 w-4 text-app-teal" aria-hidden="true" />
          صندوق عملیات
        </span>
        <span className={`inline-flex items-center gap-1 text-[11px] font-black ${alertCount ? "text-rose-700" : "text-emerald-700"}`}>
          {alertCount ? `${alertCount} مورد نیازمند رسیدگی` : "مسیر انتشار پایدار"}
          {unreadAlerts ? <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px]">{unreadAlerts}</span> : null}
          <ArrowUpLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </Link>
    </section>
  );
}

export function SignalRibbon({ items }: { items: DashboardSignal[] }) {
  return (
    <section className="dashboard-signal-ribbon overflow-hidden rounded-lg">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="relative flex min-w-0 items-center gap-3 border-b border-app-border/80 px-4 py-3 sm:border-l xl:border-b-0">
              <span className="absolute inset-y-3 right-0 w-0.5 rounded-full bg-app-borderStrong" aria-hidden="true" />
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/85 shadow-hairline ${signalToneClasses[item.tone]}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-black text-app-muted">{item.label}</span>
                <span className={`mt-0.5 block text-lg font-black ${signalToneClasses[item.tone]}`}>{item.value}</span>
                <span className="block truncate text-[10px] text-app-muted">{item.detail}</span>
              </span>
              <span className="mr-auto text-[10px] font-black text-slate-300">0{index + 1}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function LiveOperations({
  queueTotal,
  channelReady,
  workspaceReady,
  activeCampaigns,
  failedCount,
  nextWindow
}: {
  queueTotal: number;
  channelReady: boolean;
  workspaceReady: boolean;
  activeCampaigns: number;
  failedCount: number;
  nextWindow: string;
}) {
  const signals = [
    { label: "فضای کاری", value: workspaceReady ? "آماده عملیات" : "نیازمند تکمیل", healthy: workspaceReady },
    { label: "کانال‌های انتشار", value: channelReady ? "آماده" : "نیازمند بررسی", healthy: channelReady },
    { label: "کمپین‌های فعال", value: `${activeCampaigns} کمپین`, healthy: activeCampaigns > 0 },
    { label: "خطاهای باز", value: `${failedCount} مورد`, healthy: failedCount === 0 },
    { label: "حجم صف فعال", value: `${queueTotal} محتوا`, healthy: queueTotal < 10 && failedCount === 0 },
    { label: "پنجره بعدی انتشار", value: nextWindow, healthy: true }
  ];

  return (
    <section className="dashboard-live-monitor">
      <div className="dashboard-monitor-head flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="app-section-kicker text-[10px] font-black">مانیتور عملیات</p>
          <h2 className="mt-1 text-sm font-black text-app-text">سیگنال‌های فضای کاری</h2>
        </div>
        <Activity className="app-status-pulse h-4 w-4 text-app-teal" aria-hidden="true" />
      </div>
      <div className="divide-y divide-app-border/80">
        {signals.map((signal) => (
          <div key={signal.label} className="flex items-center gap-3 px-4 py-3">
            <span className={`h-2 w-2 shrink-0 rounded-full ${signal.healthy ? "bg-emerald-500" : "bg-amber-500"}`} />
            <span className="min-w-0 flex-1 text-xs font-bold text-app-muted">{signal.label}</span>
            <span className="truncate text-xs font-black text-app-text">{signal.value}</span>
          </div>
        ))}
      </div>
      <Link href="/logs" className="app-interactive flex items-center justify-between gap-3 border-t border-app-border bg-app-canvas/70 px-4 py-3 text-xs font-black text-app-primary">
        مشاهده سلامت انتشار
        <ArrowUpLeft className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
}

export function OperationsStableMark() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      پایدار
    </span>
  );
}

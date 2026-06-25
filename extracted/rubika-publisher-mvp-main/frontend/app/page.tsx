import { AuthGate } from "../components/auth-gate";
import { AppShell } from "../components/app-shell";
import { DashboardCard } from "../components/dashboard-card";
import { PageHeader } from "../components/page-header";
import { PostCard } from "../components/post-card";
import { StatusBadge } from "../components/status-badge";
import { ViewTabs } from "../components/view-tabs";

const stats = [
  { label: "پیش‌نویس", value: "۰", hint: "پست‌هایی که هنوز برای انتشار آماده نشده‌اند" },
  { label: "زمان‌بندی‌شده", value: "۰", hint: "پست‌هایی که منتظر زمان انتشار هستند" },
  { label: "منتشرشده", value: "۰", hint: "پست‌هایی که با موفقیت در روبیکا ارسال شده‌اند" },
  { label: "ناموفق", value: "۰", hint: "پست‌هایی که نیاز به بررسی یا انتشار مجدد دارند" }
];

const posts = [
  {
    title: "معرفی محصول جدید",
    caption: "متن نمونه برای نمایش کارت پست در فضای کاری. در فازهای بعدی این داده از دیتابیس خوانده می‌شود.",
    status: "draft",
    publishTime: "امروز، ۱۸:۳۰",
    attempts: "۰"
  },
  {
    title: "پست تخفیف آخر هفته",
    caption: "این کارت نشان می‌دهد پست‌های زمان‌بندی‌شده شبیه یک جریان حرفه‌ای محتوا مدیریت می‌شوند.",
    status: "scheduled",
    publishTime: "فردا، ۱۰:۰۰",
    attempts: "۰"
  },
  {
    title: "تست انتشار روبیکا",
    caption: "در فاز اتصال روبیکا، message_id و لاگ انتشار روی همین ساختار نمایش داده می‌شود.",
    status: "published",
    publishTime: "دیروز، ۱۲:۱۵",
    attempts: "۱"
  }
];

const workflow = [
  { label: "پیش‌نویس", status: "draft", count: "۰" },
  { label: "در انتظار تایید", status: "ready", count: "۰" },
  { label: "زمان‌بندی‌شده", status: "scheduled", count: "۰" },
  { label: "در حال انتشار", status: "publishing", count: "۰" },
  { label: "منتشرشده", status: "published", count: "۰" },
  { label: "ناموفق", status: "failed", count: "۰" }
];

const checklist = [
  "تکمیل پروفایل فروشگاه",
  "اتصال روبیکا",
  "ساخت اولین پست",
  "انتخاب یا آپلود رسانه",
  "زمان‌بندی اولین انتشار"
];

export default function HomePage() {
  return (
    <AuthGate>
      <AppShell>
        <PageHeader
          eyebrow="Phase 3 — Composer-Centric Creation"
          title="داشبورد فضای کاری انتشار روبیکا"
          description="این صفحه نقطه شروع فضای کاری است: ساخت محتوا، مدیریت رسانه، زمان‌بندی، انتشار و بررسی وضعیت از یک ساختار منسجم انجام می‌شود."
          actionLabel="ایجاد پست جدید"
          actionHref="/compose"
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <DashboardCard key={stat.label} label={stat.label} value={stat.value} hint={stat.hint} />
          ))}
        </div>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-app-border bg-app-surface p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-bold">چک‌لیست راه‌اندازی</h2>
            <p className="mt-2 text-sm leading-7 text-app-muted">مسیر استاندارد شروع کار برای یک فروشگاه جدید.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {checklist.map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-app-border">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-app-primary ring-1 ring-violet-100">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-app-border bg-app-surface p-5 shadow-sm">
            <h2 className="text-lg font-bold">وضعیت سیستم</h2>
            <div className="mt-4 space-y-3 text-sm text-app-muted">
              <div className="rounded-xl bg-slate-50 p-3">Frontend: آماده</div>
              <div className="rounded-xl bg-slate-50 p-3">Backend: /health</div>
              <div className="rounded-xl bg-slate-50 p-3">Rubika: نیازمند اتصال</div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-app-border bg-app-surface p-5 shadow-soft">
          <ViewTabs />
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">پست‌های اخیر</h2>
                <span className="text-xs text-app-muted">List View</span>
              </div>
              <div className="grid gap-3">
                {posts.map((post) => (
                  <PostCard key={post.title} {...post} />
                ))}
              </div>
            </div>

            <aside className="rounded-2xl border border-app-border bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">برد وضعیت</h2>
                <span className="text-xs text-app-muted">Board</span>
              </div>
              <div className="space-y-3">
                {workflow.map((item) => (
                  <div key={item.status} className="flex items-center justify-between rounded-xl bg-white p-3 ring-1 ring-app-border">
                    <div>
                      <StatusBadge status={item.status} />
                      <p className="mt-1 text-xs text-app-muted">{item.label}</p>
                    </div>
                    <span className="text-sm font-bold text-app-text">{item.count}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-app-border bg-app-surface p-5 shadow-sm">
          <h2 className="text-lg font-bold">تقویم انتشار</h2>
          <p className="mt-2 text-sm leading-7 text-app-muted">
            در فازهای بعدی این بخش به نمای تقویم واقعی تبدیل می‌شود و پست‌ها بر اساس زمان انتشار نمایش داده می‌شوند.
          </p>
          <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs text-app-muted">
            {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((day) => (
              <div key={day} className="rounded-lg bg-slate-50 py-2 font-semibold">{day}</div>
            ))}
            {Array.from({ length: 14 }).map((_, index) => (
              <div key={index} className="min-h-16 rounded-lg border border-dashed border-app-border bg-white p-2 text-right">
                {index + 1}
              </div>
            ))}
          </div>
        </section>
      </AppShell>
    </AuthGate>
  );
}

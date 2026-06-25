import { AuthGate } from "../../components/auth-gate";
import { AppShell } from "../../components/app-shell";
import { PageHeader } from "../../components/page-header";
import { WorkspaceEmptyState } from "../../components/workspace-empty-state";

const views = ["همه پست‌ها", "پیش‌نویس‌ها", "این هفته", "ناموفق‌ها"];

export default function ContentWorkspacePage() {
  return (
    <AuthGate>
      <AppShell>
        <PageHeader
          eyebrow="Phase 3 — Composer-Centric Creation"
          title="فضای محتوا"
          description="نمای مرکزی برای مدیریت همه پست‌ها. در فازهای بعدی این بخش به لیست، برد، تقویم و گرید محتوایی متصل می‌شود."
          actionLabel="ایجاد پست جدید"
          actionHref="/compose"
        />

        <section className="rounded-2xl border border-app-border bg-app-surface p-5 shadow-soft">
          <div className="mb-5 flex flex-wrap gap-2">
            {views.map((view) => (
              <span key={view} className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600">
                {view}
              </span>
            ))}
          </div>
          <WorkspaceEmptyState
            title="هنوز فضای محتوایی کامل فعال نشده است"
            description="این صفحه جایگزین پراکندگی بین پست‌ها، برد و تقویم می‌شود. فعلاً برای ساخت پست از composer جدید استفاده کنید."
            actionLabel="رفتن به composer"
            actionHref="/compose"
          />
        </section>
      </AppShell>
    </AuthGate>
  );
}

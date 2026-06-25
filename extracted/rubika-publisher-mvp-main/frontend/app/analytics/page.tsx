import { AuthGate } from "../../components/auth-gate";
import { AppShell } from "../../components/app-shell";
import { PageHeader } from "../../components/page-header";
import { WorkspaceEmptyState } from "../../components/workspace-empty-state";

export default function AnalyticsPage() {
  return (
    <AuthGate>
      <AppShell>
        <PageHeader
          eyebrow="Phase 1 — Product IA"
          title="تحلیل عملکرد"
          description="محل آینده برای آمار انتشار، نرخ خطا، بهترین روزهای انتشار و گزارش‌های محتوایی."
        />
        <WorkspaceEmptyState
          title="گزارش‌ها بعد از پایدار شدن انتشار فعال می‌شوند"
          description="این صفحه فعلاً برای کامل شدن معماری محصول اضافه شده است. داده واقعی پس از ثبت لاگ انتشار و آمار عملکرد روبیکا نمایش داده می‌شود."
        />
      </AppShell>
    </AuthGate>
  );
}

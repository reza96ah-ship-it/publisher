import { AuthGate } from "../../components/auth-gate";
import { AppShell } from "../../components/app-shell";
import { PageHeader } from "../../components/page-header";
import { WorkspaceEmptyState } from "../../components/workspace-empty-state";

export default function InboxPage() {
  return (
    <AuthGate>
      <AppShell>
        <PageHeader
          eyebrow="Phase 1 — Product IA"
          title="صندوق پیام‌ها"
          description="محل آینده برای مدیریت پیام‌ها، کامنت‌ها و تعاملات مشتریان پس از پایدار شدن انتشار و اتصال روبیکا."
        />
        <WorkspaceEmptyState
          title="صندوق پیام‌ها هنوز به API متصل نیست"
          description="این مسیر از الان در ساختار محصول وجود دارد تا معماری ناوبری کامل باشد، اما پیاده‌سازی عملیاتی آن در فازهای رشد و تعاملات انجام می‌شود."
        />
      </AppShell>
    </AuthGate>
  );
}

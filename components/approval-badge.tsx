import { ShieldCheck } from "lucide-react";
import { approvalConfig } from "../lib/posts";
import { StatusToken } from "./workspace-ui";

export function ApprovalBadge({ status, compact = false }: { status?: string | null; compact?: boolean }) {
  const config = approvalConfig(status);

  return (
    <StatusToken tone={config.tone} className="gap-1">
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {compact ? config.label.replace("بازبینی ", "") : config.label}
    </StatusToken>
  );
}

import type { ReactNode } from "react";
import { StatusToken } from "../workspace-ui";

type TagTone = "neutral" | "primary" | "success" | "warning" | "alert" | "info";

type TagProps = {
  tone?: TagTone;
  children: ReactNode;
  className?: string;
};

export function Tag({ tone = "neutral", children, className = "" }: TagProps) {
  return (
    <StatusToken tone={tone} className={className}>
      {children}
    </StatusToken>
  );
}

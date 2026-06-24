import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

export type ButtonLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  disabled?: boolean;
};

export function ButtonLink({ href, variant = "primary", size = "md", children, disabled, ...props }: ButtonLinkProps) {
  return (
    <Button href={href} variant={variant} size={size} disabled={disabled} {...props}>
      {children}
    </Button>
  );
}

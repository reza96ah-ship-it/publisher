import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type SharedButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
};

type ButtonAsButtonProps = SharedButtonProps & ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: never;
};

type ButtonAsLinkProps = SharedButtonProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  disabled?: boolean;
};

type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-app-primary text-white shadow-sm hover:bg-app-primaryHover",
  secondary: "border border-app-border bg-white text-slate-700 hover:bg-slate-50",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-app-text",
  danger: "bg-rose-50 text-rose-700 hover:bg-rose-100"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-sm"
};

export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", className = "", children } = props;
  const classes = [
    "inline-flex items-center justify-center rounded-xl font-semibold transition disabled:pointer-events-none disabled:opacity-60",
    variantClasses[variant],
    sizeClasses[size],
    className
  ].join(" ");

  if ("href" in props && props.href) {
    const { href, disabled, variant: _variant, size: _size, className: _className, children: _children, ...linkProps } = props;

    return (
      <Link
        href={href}
        className={classes}
        aria-disabled={disabled || linkProps["aria-disabled"]}
        tabIndex={disabled ? -1 : linkProps.tabIndex}
        {...linkProps}
      >
        {children}
      </Link>
    );
  }

  const { variant: _variant, size: _size, className: _className, children: _children, type = "button", ...buttonProps } = props;

  return (
    <button type={type} className={classes} {...buttonProps}>
      {children}
    </button>
  );
}

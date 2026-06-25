import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
};

export function Field({ label, hint, error, required, children }: FieldProps) {
  return (
    <label className="block min-w-0 text-sm font-semibold text-app-text">
      <span className="flex items-center gap-1">
        {label}
        {required ? <span className="text-rose-600">*</span> : null}
      </span>
      {hint ? <span className="mt-1 block text-xs leading-5 text-app-muted">{hint}</span> : null}
      <div className="mt-2">{children}</div>
      {error ? <span className="mt-2 block text-xs font-medium text-rose-600">{error}</span> : null}
    </label>
  );
}

const controlClassName =
  "w-full rounded-md border border-app-border bg-white px-3.5 py-2.5 text-base md:text-sm text-app-text shadow-[0_1px_2px_rgba(38,75,88,0.035)] outline-none transition placeholder:text-slate-400 focus:border-app-primary focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlClassName} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${controlClassName} min-h-28 leading-7 ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${controlClassName} ${className}`} {...props} />;
}


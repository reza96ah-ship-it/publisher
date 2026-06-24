"use client";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastTone = "success" | "warning" | "alert" | "info";

type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  actionHref?: string;
  actionLabel?: string;
};

type ToastItem = ToastInput & {
  id: number;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClasses: Record<ToastTone, string> = {
  success: "border-emerald-200 bg-white text-emerald-700",
  warning: "border-amber-200 bg-white text-amber-700",
  alert: "border-rose-200 bg-white text-rose-700",
  info: "border-blue-200 bg-white text-app-primary"
};

const toneIcons = {
  success: CheckCircle2,
  warning: AlertTriangle,
  alert: AlertTriangle,
  info: Info
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast: ToastInput) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-3), { ...toast, id }]);
    window.setTimeout(() => dismiss(id), 4200);
  }, [dismiss]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-4 z-[70] grid w-[min(360px,calc(100vw-2rem))] gap-2" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => {
          const tone = toast.tone ?? "info";
          const Icon = toneIcons[tone];
          return (
            <div key={toast.id} className={`app-popover pointer-events-auto flex gap-3 rounded-md border p-3 shadow-lg shadow-slate-200/70 ${toneClasses[tone]}`}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-app-text">{toast.title}</p>
                {toast.description ? <p className="mt-1 text-xs leading-5 text-app-muted">{toast.description}</p> : null}
                {toast.actionHref && toast.actionLabel ? (
                  <Link href={toast.actionHref} className="mt-2 inline-flex text-xs font-black text-app-primary hover:text-app-primaryHover">
                    {toast.actionLabel}
                  </Link>
                ) : null}
              </div>
              <button type="button" onClick={() => dismiss(toast.id)} className="app-interactive flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-50 hover:text-slate-700" aria-label="بستن اعلان">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

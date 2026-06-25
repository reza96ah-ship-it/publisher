import { X } from "lucide-react";
import { ReactNode, useEffect } from "react";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  position?: "left" | "right";
  width?: string;
};

export function Drawer({ open, onClose, title, subtitle, children, position = "left", width = "max-w-[400px]" }: DrawerProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex bg-slate-900/40 backdrop-blur-[2px] transition-opacity" role="dialog" aria-modal="true" aria-label={title}>
      {position === "right" ? (
        <button type="button" className="min-w-0 flex-1 cursor-default" onClick={onClose} aria-label="بستن" />
      ) : null}
      
      <aside className={`flex h-full w-full ${width} flex-col bg-white shadow-2xl transition-transform ${position === "right" ? "border-l" : "border-r"} border-app-border`}>
        <div className="flex items-start justify-between gap-3 border-b border-app-border px-4 py-4 bg-slate-50/50">
          <div>
            <h2 className="text-sm font-black text-app-text">{title}</h2>
            {subtitle && <p className="mt-1 text-xs leading-5 text-app-muted">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700" aria-label="بستن">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
      </aside>

      {position === "left" ? (
        <button type="button" className="min-w-0 flex-1 cursor-default" onClick={onClose} aria-label="بستن" />
      ) : null}
    </div>
  );
}


const tabs = ["لیست", "برد", "تقویم", "لاگ‌ها"];

export function ViewTabs() {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-app-border pb-3">
      {tabs.map((tab, index) => (
        <button
          key={tab}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            index === 0
        ? "bg-blue-50 text-app-primary ring-1 ring-blue-100"
              : "text-app-muted hover:bg-slate-100 hover:text-app-text"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

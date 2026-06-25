type DashboardCardProps = {
  label: string;
  value: string;
  hint: string;
};

export function DashboardCard({ label, value, hint }: DashboardCardProps) {
  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-app-muted">{label}</p>
          <p className="mt-3 text-3xl font-bold text-app-text">{value}</p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-blue-50" />
      </div>
      <p className="mt-4 text-xs leading-6 text-app-muted">{hint}</p>
    </div>
  );
}


import { Input, Select } from "./ui/form";

type FilterBarProps = {
  searchPlaceholder?: string;
  statusOptions?: Array<{ label: string; value: string }>;
  platformOptions?: Array<{ label: string; value: string }>;
};

export function FilterBar({
  searchPlaceholder = "جست‌وجو...",
  statusOptions = [],
  platformOptions = []
}: FilterBarProps) {
  return (
    <div className="grid gap-3 rounded-2xl border border-app-border bg-slate-50 p-3 md:grid-cols-3">
      <Input placeholder={searchPlaceholder} />
      <Select defaultValue="">
        <option value="">همه وضعیت‌ها</option>
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </Select>
      <Select defaultValue="">
        <option value="">همه کانال‌ها</option>
        {platformOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </Select>
    </div>
  );
}

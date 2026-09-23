"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SelectOption = { value: string; label: string };

// Base UI's <Select.Value> only echoes the label when the Root is given an `items`
// map — without it, it shows the raw stored value. Centralizing that here avoids
// re-wiring `items` at every call site.
export function FormSelect({
  value,
  onChange,
  options,
  placeholder = "Vyberte…",
  className,
}: {
  value?: string | null;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}) {
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));
  return (
    <Select items={items} value={value ?? undefined} onValueChange={(v) => v !== null && onChange(v)}>
      <SelectTrigger className={className ?? "w-full"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const groupFormatter = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 });

function toDisplay(value: unknown) {
  const num = typeof value === "string" ? Number(value.replace(",", ".")) : typeof value === "number" ? value : NaN;
  if (Number.isNaN(num)) return "";
  return groupFormatter.format(num);
}

function toNumber(raw: string): number {
  const normalized = raw.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const num = Number(normalized);
  return Number.isNaN(num) ? 0 : num;
}

// Thousands-grouped number input for money/quantity fields (react-hook-form
// Controller pattern, same shape as FormSelect/FormCombobox: value + onChange).
// Shows "125 000" while idle, switches to the raw editable string while focused
// so the cursor doesn't jump around the inserted separators as the user types.
export function FormCurrencyInput({
  value,
  onChange,
  suffix = "Kč",
  className,
  placeholder,
}: {
  value?: unknown;
  onChange: (value: number) => void;
  suffix?: string | null;
  className?: string;
  placeholder?: string;
}) {
  const [focused, setFocused] = React.useState(false);
  const [rawText, setRawText] = React.useState("");

  const displayValue = focused ? rawText : toDisplay(value);

  return (
    <div className="relative">
      <Input
        inputMode="decimal"
        value={displayValue}
        placeholder={placeholder}
        className={cn(suffix && "pr-9", className)}
        onFocus={() => {
          setRawText(value === null || value === undefined || value === "" ? "" : String(value).replace(".", ","));
          setFocused(true);
        }}
        onChange={(e) => {
          setRawText(e.target.value);
          onChange(toNumber(e.target.value));
        }}
        onBlur={() => setFocused(false)}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}

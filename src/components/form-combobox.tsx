"use client";

import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export type ComboboxOption = { value: string; label: string; hint?: string };

// Searchable stand-in for FormSelect, for fields that reference another entity
// (company, contact, deal, product…) where a plain <select> would mean scrolling
// through hundreds of rows to find one. Same value/onChange/options contract as
// FormSelect so call sites can swap between the two freely.
//
// Deliberately NOT built on the Popover primitive: these dialogs live inside a
// Base UI Dialog, and a portaled Popover's outside-press detection misfires the
// instant its content unmounts on select, dismissing the parent Dialog along with
// it (confirmed while wiring this up — selecting any option silently discarded
// the whole form). Rendering the panel inline as an absolutely-positioned div
// keeps everything inside the Dialog's own DOM subtree, so no such cross-layer
// dismissal is possible.
//
// With `creatable`, a typed value that matches no option can be accepted as-is —
// for fields like "obor" or "kategorie" that benefit from a picklist without being
// a closed enum.
export function FormCombobox({
  value,
  onChange,
  options,
  placeholder = "Vyberte…",
  searchPlaceholder = "Hledat…",
  emptyText = "Nic nenalezeno.",
  className,
  allowClear,
  clearLabel = "Bez výběru",
  creatable = false,
}: {
  value?: string | null;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  allowClear?: boolean;
  clearLabel?: string;
  creatable?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? (creatable && value ? value : undefined);
  const trimmedQuery = query.trim();
  const filteredOptions = creatable
    ? options.filter((o) => o.label.toLowerCase().includes(trimmedQuery.toLowerCase()))
    : options;
  const exactMatch = filteredOptions.some((o) => o.label.toLowerCase() === trimmedQuery.toLowerCase());

  function select(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm whitespace-nowrap outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50",
          className,
        )}
      >
        <span className={cn("truncate text-left", !displayLabel && "text-muted-foreground")}>
          {displayLabel ?? placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-56 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10">
          <Command shouldFilter={!creatable} className="rounded-lg!">
            <CommandInput autoFocus placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>
                {creatable && trimmedQuery ? (
                  <button
                    type="button"
                    className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => select(trimmedQuery)}
                  >
                    Použít „{trimmedQuery}“
                  </button>
                ) : (
                  emptyText
                )}
              </CommandEmpty>
              <CommandGroup>
                {allowClear && (
                  <CommandItem value="__clear__" onSelect={() => select("")}>
                    <span className="text-muted-foreground">{clearLabel}</span>
                  </CommandItem>
                )}
                {filteredOptions.map((o) => (
                  <CommandItem key={o.value} value={o.label} data-checked={o.value === value} onSelect={() => select(o.value)}>
                    {o.label}
                    {o.hint && <span className="ml-auto text-xs text-muted-foreground">{o.hint}</span>}
                  </CommandItem>
                ))}
                {creatable && trimmedQuery && !exactMatch && (
                  <CommandItem value={`__create__${trimmedQuery}`} onSelect={() => select(trimmedQuery)}>
                    Použít „{trimmedQuery}“
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}

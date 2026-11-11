"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

export function FilterMenu({
  label,
  param,
  value,
  options,
  align = "start",
  className,
}: {
  label?: string;
  param: string;
  value: string;
  options: FilterOption[];
  align?: "start" | "end";
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = options.find((o) => o.value === value);

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === options[0]?.value) params.delete(param);
    else params.set(param, next);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "group inline-flex h-[30px] shrink-0 items-center overflow-hidden rounded-full bg-secondary text-xs text-foreground shadow-raised transition-colors duration-150 hover:bg-muted aria-expanded:bg-muted",
              className,
            )}
          >
            {label && (
              <>
                <span className="px-[9px] text-subtle">{label}</span>
                <span aria-hidden className="h-full w-px bg-white/8" />
              </>
            )}
            <span className="flex items-center gap-1.5 px-[9px]">
              {current?.label ?? value}
              <ChevronDown className="size-3 text-[#898b8d] transition-transform duration-200 ease-power3-out group-aria-expanded:rotate-180" />
            </span>
          </button>
        }
      />
      <DropdownMenuContent align={align} className="w-auto min-w-44">
        <DropdownMenuGroup>
          {label && <DropdownMenuLabel>{label}</DropdownMenuLabel>}
          <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(String(v))}>
            {options.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

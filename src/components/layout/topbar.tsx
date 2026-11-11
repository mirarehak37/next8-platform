"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Bell, LogOut, Settings, Menu, AlarmClock, CalendarClock, ArrowRight, Building2, BookUser, KanbanSquare,
  UserPlus, CornerDownLeft, Sparkles,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  CommandDialog, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { logoutAction } from "@/lib/actions/auth";
import { quickSearch, type QuickSearchResult } from "@/lib/actions/search";
import { NAV_GROUPS } from "@/lib/nav-config";
import { can, type ModuleResource } from "@/lib/rbac";
import { formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SidebarContent, type SidebarData } from "@/components/layout/sidebar";
import { CountBadge } from "@/components/common/count-badge";

export type TopbarTask = { id: string; title: string; dueDate: string | null };

const ROUND_BTN =
  "inline-flex size-[30px] shrink-0 items-center justify-center rounded-full bg-secondary text-foreground shadow-raised transition-colors duration-150 hover:bg-muted aria-expanded:bg-muted";

const GROUP_ICONS: Record<string, typeof Building2> = {
  Kluby: Building2,
  Kontakty: BookUser,
  "Obchodní případy": KanbanSquare,
  Leady: UserPlus,
};

export function Topbar({
  userName,
  role,
  jobTitle,
  overdue,
  dueToday,
  sidebar,
}: {
  userName: string;
  role: string;
  jobTitle?: string;
  overdue: TopbarTask[];
  dueToday: TopbarTask[];
  sidebar: SidebarData;
}) {
  const [isPending, startTransition] = useTransition();
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const notificationCount = sidebar.overdueTasks + dueToday.length;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="flex shrink-0 items-center justify-between gap-2 px-4 py-[14px] sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button type="button" className={cn(ROUND_BTN, "lg:hidden")} aria-label="Otevřít navigaci" onClick={() => setNavOpen(true)}>
          <Menu className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-keyshortcuts="Meta+K Control+K"
          className="flex h-[30px] w-full max-w-[320px] items-center gap-2 rounded-full bg-secondary pr-1.5 pl-3 text-left text-xs text-subtle shadow-raised transition-colors duration-150 hover:bg-muted hover:text-soft"
        >
          <Search className="size-3.5 shrink-0" aria-hidden />
          <span className="flex-1 truncate">Hledat kluby, kontakty, obchody…</span>
          <kbd className="hidden h-5 items-center rounded-full border-[0.5px] border-[#414141] bg-muted px-1.5 font-sans text-[11px] text-chip sm:inline-flex">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Popover>
          <PopoverTrigger
            render={
              <button type="button" className={cn(ROUND_BTN, "relative")} aria-label="Notifikace">
                <Bell className="size-3.5" />
                {notificationCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-brand ring-2 ring-background" />
                )}
              </button>
            }
          />
          <PopoverContent align="end" className="w-80 gap-0 p-0">
            <div className="flex items-center justify-between border-b px-3 py-2.5">
              <span className="text-sm font-medium">Notifikace</span>
              {notificationCount > 0 && <CountBadge>{notificationCount}</CountBadge>}
            </div>
            <div className="max-h-80 overflow-y-auto p-1">
              {notificationCount === 0 && (
                <p className="caption-style px-3 py-8 text-center text-subtle">Žádné nové notifikace. Máte hotovo.</p>
              )}
              {overdue.map((task) => (
                <NotificationRow key={task.id} icon={AlarmClock} tone="danger" title={task.title} meta={`Po termínu · ${formatDate(task.dueDate)}`} />
              ))}
              {sidebar.overdueTasks > overdue.length && (
                <p className="caption-style px-3 py-1.5 text-subtle">…a dalších {sidebar.overdueTasks - overdue.length} po termínu</p>
              )}
              {dueToday.map((task) => (
                <NotificationRow key={task.id} icon={CalendarClock} tone="warning" title={task.title} meta="Termín dnes" />
              ))}
            </div>
            <a
              href={sidebar.overdueTasks > 0 ? "/tasks?filter=overdue" : "/tasks"}
              className="flex items-center justify-between border-t px-3 py-2.5 text-xs text-soft transition-colors hover:text-foreground"
            >
              Zobrazit všechny úkoly
              <ArrowRight className="size-3.5" />
            </a>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex h-[30px] items-center gap-1.5 rounded-full bg-secondary py-[5px] pr-2.5 pl-[5px] text-xs shadow-raised transition-colors duration-150 hover:bg-muted aria-expanded:bg-muted"
              >
                <span className="flex size-5 items-center justify-center rounded-full bg-brand text-[9px] font-semibold text-white">
                  {initials(userName)}
                </span>
                <span className="hidden max-w-[140px] truncate sm:inline">{userName}</span>
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="font-medium text-foreground">{userName}</div>
                <div className="text-xs font-normal text-subtle">{jobTitle ?? role}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {can(role, "admin", "view") && (
                <DropdownMenuItem render={<a href="/admin/users" />}>
                  <Settings className="size-4" /> Nastavení účtu
                </DropdownMenuItem>
              )}
              <DropdownMenuItem render={<a href="/settings/claude" />}>
                <Sparkles className="size-4" /> Připojení ke Claude
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSearchOpen(true)}>
                <Search className="size-4" /> Hledat
                <span className="ml-auto text-xs text-subtle">⌘K</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={isPending} onClick={() => startTransition(() => logoutAction())}>
                <LogOut className="size-4" /> Odhlásit se
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-[254px] max-w-[85vw] gap-0 border-sidebar-border bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigace</SheetTitle>
          <SidebarContent data={sidebar} onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} role={role} />
    </header>
  );
}

function NotificationRow({
  icon: Icon,
  tone,
  title,
  meta,
}: {
  icon: typeof Bell;
  tone: "danger" | "warning";
  title: string;
  meta: string;
}) {
  return (
    <a href="/tasks" className="flex items-start gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-white/4">
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
          tone === "danger" ? "bg-(--tag-red-bg) text-danger" : "bg-(--tag-amber-bg) text-warning",
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm">{title}</span>
        <span className="caption-style text-subtle">{meta}</span>
      </span>
    </a>
  );
}

function CommandMenu({ open, onOpenChange, role }: { open: boolean; onOpenChange: (open: boolean) => void; role: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QuickSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const navItems = useMemo(
    () =>
      NAV_GROUPS.flatMap((group) => group.items).filter(
        (item) => !item.resource || can(role, item.resource as ModuleResource, "view"),
      ),
    [role],
  );

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      quickSearch(q)
        .then((r) => !cancelled && setResults(r))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setLoading(false));
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function go(href: string) {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  }

  const q = query.trim().toLowerCase();
  const matchingNav = navItems.filter((item) => !q || item.label.toLowerCase().includes(q)).slice(0, q ? 4 : 8);
  const visibleResults = q.length < 2 ? [] : results;
  const groups = visibleResults.reduce<Record<string, QuickSearchResult[]>>((acc, r) => {
    (acc[r.group] ??= []).push(r);
    return acc;
  }, {});

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
      title="Vyhledávání"
      description="Hledejte kluby, kontakty, obchody a stránky"
      className="sm:max-w-[560px]"
    >
      <Command shouldFilter={false}>
        <CommandInput placeholder="Hledat kluby, kontakty, obchody…" value={query} onValueChange={setQuery} />
        <CommandList className="max-h-[380px]">
          <CommandEmpty>{loading ? "Hledám…" : q.length < 2 ? "Začněte psát…" : "Nic nenalezeno."}</CommandEmpty>
          {Object.entries(groups).map(([group, items]) => {
            const Icon = GROUP_ICONS[group] ?? Search;
            return (
              <CommandGroup key={group} heading={group}>
                {items.map((item) => (
                  <CommandItem key={`${group}-${item.id}`} value={`${group}-${item.id}`} onSelect={() => go(item.href)}>
                    <Icon className="text-subtle" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.hint && <span className="max-w-[45%] shrink-0 truncate text-xs text-subtle">{item.hint}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
          {matchingNav.length > 0 && (
            <CommandGroup heading="Přejít na">
              {matchingNav.map((item) => (
                <CommandItem key={item.href} value={`nav-${item.href}`} onSelect={() => go(item.href)}>
                  <ArrowRight className="text-subtle" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {q.length >= 2 && (
            <CommandGroup heading="Další">
              <CommandItem value="full-search" onSelect={() => go(`/search?q=${encodeURIComponent(query.trim())}`)}>
                <CornerDownLeft className="text-subtle" />
                Všechny výsledky pro „{query.trim()}“
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

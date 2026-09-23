"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, Bell, LogOut, Settings, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { logoutAction } from "@/lib/actions/auth";
import { MobileNav } from "@/components/layout/mobile-nav";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function Topbar({
  userName,
  role,
  jobTitle,
  overdueTasks,
}: {
  userName: string;
  role: string;
  jobTitle?: string;
  overdueTasks: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <header className="h-16 border-b bg-background flex items-center gap-4 px-4 sm:px-6 sticky top-0 z-20">
      <MobileNav role={role} />
      <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hledat firmy, kontakty, obchody…"
          className="pl-8 h-9 bg-muted/40 border-none"
        />
      </form>

      <div className="ml-auto flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="relative rounded-full p-2 hover:bg-muted transition-colors">
                <Bell className="h-4.5 w-4.5" />
                {overdueTasks > 0 && (
                  <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 justify-center rounded-full bg-rose-600 text-[10px]">
                    {overdueTasks}
                  </Badge>
                )}
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Notifikace</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {overdueTasks > 0 ? (
                <DropdownMenuItem render={<a href="/tasks?filter=overdue" />}>
                  Máte {overdueTasks} úkolů po termínu
                </DropdownMenuItem>
              ) : (
                <div className="px-2 py-3 text-sm text-muted-foreground">Žádné nové notifikace</div>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs bg-[#FF1947] text-white">{initials(userName)}</AvatarFallback>
                </Avatar>
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-medium leading-none">{userName}</div>
                  <div className="text-[11px] text-muted-foreground leading-none mt-0.5">{role}</div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="font-medium">{userName}</div>
                <div className="text-xs text-muted-foreground font-normal">{jobTitle ?? role}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<a href="/admin/users" />}>
                <Settings className="h-4 w-4" /> Nastavení účtu
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={isPending}
                onSelect={() => startTransition(() => logoutAction())}
              >
                <LogOut className="h-4 w-4" /> Odhlásit se
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

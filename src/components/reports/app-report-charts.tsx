"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Legend,
} from "recharts";
import { syncAppNow } from "@/lib/actions/app-sync";
import { Button } from "@/components/ui/button";

const AXIS = { fontSize: 11, stroke: "#676767", tickLine: false, axisLine: false } as const;
const GRID = { strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.06)" } as const;
const TOOLTIP = {
  contentStyle: { background: "#1a1a1a", border: "1px solid #393939", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#a4a4a4" },
  cursor: { fill: "rgba(255,255,255,0.04)" },
} as const;

export function RegistrationsChart({ data }: { data: { week: string; registrations: number; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="week" {...AXIS} interval="preserveStartEnd" minTickGap={24} />
        <YAxis yAxisId="new" {...AXIS} allowDecimals={false} />
        <YAxis yAxisId="total" orientation="right" {...AXIS} allowDecimals={false} />
        <Tooltip {...TOOLTIP} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="new" dataKey="registrations" name="Nové registrace" fill="#FF1947" radius={[3, 3, 0, 0]} />
        <Line yAxisId="total" dataKey="total" name="Uživatelů celkem" stroke="#7a68ff" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function ActivityTrendChart({ data }: { data: { date: string; active7: number; active30: number; pro: number }[] }) {
  if (data.length < 2) {
    return (
      <p className="caption-style flex h-[220px] items-center justify-center px-6 text-center leading-snug text-subtle">
        Vývoj v čase se začne kreslit po druhé synchronizaci (každou noc přibude jeden bod).
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="date" {...AXIS} minTickGap={24} />
        <YAxis {...AXIS} allowDecimals={false} />
        <Tooltip {...TOOLTIP} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line dataKey="active7" name="Aktivní za 7 dní" stroke="#22c55e" strokeWidth={2} dot={false} />
        <Line dataKey="active30" name="Aktivní za 30 dní" stroke="#38bdf8" strokeWidth={2} dot={false} />
        <Line dataKey="pro" name="PRO" stroke="#FF1947" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SyncNowButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const r = await syncAppNow();
            toast.success(`Synchronizováno: ${r.users} uživatelů (${r.created} nových, ${r.updated} aktualizovaných).`);
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Synchronizace se nezdařila.");
          }
        })
      }
    >
      <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} />
      {pending ? "Synchronizuji…" : "Synchronizovat teď"}
    </Button>
  );
}

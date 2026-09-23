"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";

const COLORS = ["#FF1947", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#14b8a6"];

export function PipelineFunnelChart({ data }: { data: { stage: string; value: number; count: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Obchodní pipeline</CardTitle>
        <CardDescription>Hodnota otevřených obchodů podle fáze</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
            <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 1000)}k`} fontSize={12} />
            <YAxis type="category" dataKey="stage" width={90} fontSize={12} />
            <Tooltip
              formatter={(value, name) => (name === "value" ? formatCurrency(Number(value)) : value)}
              labelClassName="text-xs"
            />
            <Bar dataKey="value" fill="#FF1947" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function TrendChart({ data }: { data: { month: string; won: number; lost: number; open: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vývoj obchodů v čase</CardTitle>
        <CardDescription>Hodnota uzavřených a otevřených obchodů za posledních 6 měsíců</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="wonGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="openGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF1947" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#FF1947" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} fontSize={12} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Area type="monotone" dataKey="won" stroke="#10b981" fill="url(#wonGradient)" strokeWidth={2} name="Vyhráno" />
            <Area type="monotone" dataKey="open" stroke="#FF1947" fill="url(#openGradient)" strokeWidth={2} name="Otevřené" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function LeadSourceChart({ data }: { data: { source: string; count: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Zdroje leadů</CardTitle>
        <CardDescription>Odkud přichází nová poptávka</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="source" innerRadius={45} outerRadius={80} paddingAngle={2}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-2">
          {data.map((d, i) => (
            <div key={d.source} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              {d.source} ({d.count})
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

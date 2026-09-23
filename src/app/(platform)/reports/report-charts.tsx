"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";

export function SimpleBarChart({
  data,
  format = "currency",
}: {
  data: { label: string; value: number }[];
  format?: "currency" | "count";
}) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">Zatím žádná data.</p>;
  const formatValue = (v: number) => (format === "count" ? `${v}×` : formatCurrency(v));
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
        <XAxis type="number" tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} fontSize={12} />
        <YAxis type="category" dataKey="label" width={110} fontSize={12} />
        <Tooltip formatter={(value) => formatValue(Number(value))} />
        <Bar dataKey="value" fill="#FF1947" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenueBarChart({ title, description, data }: { title: string; description: string; data: { label: string; value: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <SimpleBarChart data={data} />
      </CardContent>
    </Card>
  );
}

export function ReasonsChart({ data }: { data: { reason: string; count: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Důvody prohry</CardTitle>
        <CardDescription>Proč obchody nejčastěji nevyhráváme</CardDescription>
      </CardHeader>
      <CardContent>
        <SimpleBarChart data={data.map((d) => ({ label: d.reason, value: d.count }))} format="count" />
      </CardContent>
    </Card>
  );
}

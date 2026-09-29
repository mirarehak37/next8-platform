import { CZ_MAP, projectLonLat } from "@/data/cz-regions-map";
import { MARKET_STATES, type MarketClub } from "@/lib/market";
import type { KrajCode } from "@/lib/kraje";

// Where each region's number sits (roughly its centre; Praha's is pulled out of the tiny polygon).
const LABEL_AT: Record<KrajCode, [number, number]> = {
  PHA: [14.47, 50.08], STC: [14.62, 49.8], JHC: [14.45, 49.12], PLK: [13.25, 49.55], KVK: [12.75, 50.2], ULK: [13.85, 50.5],
  LBK: [15.0, 50.72], HKK: [15.85, 50.35], PAK: [16.05, 49.9], VYS: [15.6, 49.4], JHM: [16.6, 49.0], OLK: [17.2, 49.75],
  ZLK: [17.75, 49.2], MSK: [18.1, 49.85],
};

export type MapRegion = { code: KrajCode; label: string; value: number; display: string; title: string };

export function MarketMap({
  regions,
  clubs,
  selected,
  hrefFor,
  tone,
}: {
  regions: MapRegion[];
  clubs: MarketClub[];
  selected?: string;
  hrefFor: (code: string) => string;
  tone: "coverage" | "potential";
}) {
  const max = Math.max(1, ...regions.map((r) => r.value));
  const color = tone === "coverage" ? "#10b981" : "#FF1947";
  const fill = new Map(MARKET_STATES.map((s) => [s.value, s.fill]));

  // Spread clubs from the same town in a small spiral so they don't hide each other.
  const seen = new Map<string, number>();
  const dots = clubs
    .filter((c) => c.lat != null && c.lon != null)
    .sort((a, b) => (b.state === "untouched" ? 1 : 0) - (a.state === "untouched" ? 1 : 0)) // paint untouched first, customers on top
    .map((c) => {
      const key = `${c.lat},${c.lon}`;
      const i = seen.get(key) ?? 0;
      seen.set(key, i + 1);
      const p = projectLonLat(c.lon!, c.lat!);
      const r = i === 0 ? 0 : 3.2 * Math.sqrt(i);
      return { c, x: p.x + r * Math.cos(i * 2.4), y: p.y + r * Math.sin(i * 2.4) };
    });

  return (
    <svg viewBox={`0 0 ${CZ_MAP.width} ${CZ_MAP.height}`} className="w-full h-auto" role="img" aria-label="Mapa krajů České republiky">
      {regions.map((r) => {
        const d = CZ_MAP.regions[r.code];
        const t = r.value / max;
        const isSel = selected === r.code;
        return (
          <a key={r.code} href={hrefFor(r.code)}>
            <title>{r.title}</title>
            <path
              d={d}
              fill={color}
              fillOpacity={0.06 + 0.55 * t}
              className={isSel ? "stroke-foreground" : "stroke-background hover:opacity-80"}
              strokeWidth={isSel ? 3 : 1.5}
            />
          </a>
        );
      })}
      {dots.map(({ c, x, y }) => (
        <a key={c.id} href={`/crm/companies/${c.id}`}>
          <title>{`${c.name} · ${c.city ?? ""} · ${MARKET_STATES.find((s) => s.value === c.state)?.label}`}</title>
          <circle cx={x} cy={y} r={c.state === "untouched" ? 3.2 : 4.5} fill={fill.get(c.state)} className="stroke-background" strokeWidth={1} />
        </a>
      ))}
      {regions.map((r) => {
        const [lon, lat] = LABEL_AT[r.code];
        const p = projectLonLat(lon, lat);
        return (
          <g key={r.code} pointerEvents="none" textAnchor="middle" className="fill-foreground">
            <text x={p.x} y={p.y} fontSize={r.code === "PHA" ? 16 : 22} fontWeight={700} paintOrder="stroke" className="stroke-background" strokeWidth={4}>
              {r.display}
            </text>
            {r.code !== "PHA" && (
              <text x={p.x} y={p.y + 17} fontSize={12} paintOrder="stroke" className="stroke-background fill-muted-foreground" strokeWidth={3}>
                {r.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

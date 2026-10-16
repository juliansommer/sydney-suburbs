import { useId } from "react"

import { type HeatBucket, type Heatmap, NO_DATA } from "@/lib/heatmap"
import {
  HEATMAP_STATS,
  type HeatmapStat,
  type StatInfo,
  STATS,
} from "@/lib/stats"
import { cn } from "@/lib/utils"

interface HeatmapLegendProps {
  stat: HeatmapStat
  // Undefined while the facts load.
  heatmap: Heatmap | undefined
  onStatChange: (stat: HeatmapStat) => void
}

// The stat picker and a key of each colour's range, highest at the top.
export function HeatmapLegend({
  stat,
  heatmap,
  onStatChange,
}: HeatmapLegendProps) {
  const selectId = useId()
  const info = STATS[stat]
  const buckets = heatmap?.buckets.toReversed() ?? []
  return (
    <div className="flex w-64 flex-col gap-2 rounded-xl border bg-card p-3 text-card-foreground shadow-lg">
      <label className="sr-only" htmlFor={selectId}>
        Statistic
      </label>
      <select
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm font-medium"
        id={selectId}
        onChange={(event) => {
          const next = HEATMAP_STATS.find((s) => s === event.target.value)
          if (next) {
            onStatChange(next)
          }
        }}
        value={stat}
      >
        {HEATMAP_STATS.map((s) => (
          <option key={s} value={s}>
            {STATS[s].label}
          </option>
        ))}
      </select>
      <ul
        aria-label={`${info.label} key`}
        className="flex flex-col gap-1 text-xs"
      >
        {buckets.map((b) => (
          <li className="flex items-center gap-2" key={b.swatch}>
            <Swatch className={b.swatch} />
            {bucketLabel(b, info)}
          </li>
        ))}
        {heatmap?.hasNoData ? (
          <li className="flex items-center gap-2 text-muted-foreground">
            <Swatch className={NO_DATA.swatch} />
            No data
          </li>
        ) : null}
      </ul>
      <p className="text-xs text-muted-foreground">{info.source}</p>
    </div>
  )
}

function bucketLabel({ from, to }: HeatBucket, info: StatInfo): string {
  if (from === null) {
    return to === null ? "All" : `Under ${info.format(to)}`
  }
  if (to === null) {
    return `${info.format(from)} and over`
  }
  return `${info.number(from)} – ${info.format(to)}`
}

interface SwatchProps {
  className: string
}

function Swatch({ className }: SwatchProps) {
  return (
    <span
      aria-hidden
      className={cn("size-3.5 shrink-0 rounded-sm border", className)}
    />
  )
}

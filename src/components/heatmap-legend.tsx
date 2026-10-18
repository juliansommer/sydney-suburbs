import { createUniqueId, For, Show } from "solid-js"

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
export function HeatmapLegend(props: HeatmapLegendProps) {
  const selectId = createUniqueId()
  const info = () => STATS[props.stat]
  return (
    <div class="flex w-64 flex-col gap-2 rounded-xl border bg-card p-3 text-card-foreground shadow-lg">
      <label class="sr-only" for={selectId}>
        Statistic
      </label>
      <select
        class="h-8 rounded-lg border border-input bg-background px-2 text-sm font-medium"
        id={selectId}
        onChange={(event) => {
          const next = HEATMAP_STATS.find(
            (s) => s === event.currentTarget.value,
          )
          if (next) {
            props.onStatChange(next)
          }
        }}
        value={props.stat}
      >
        <For each={HEATMAP_STATS}>
          {(s) => <option value={s}>{STATS[s].label}</option>}
        </For>
      </select>
      <ul
        aria-label={`${info().label} key`}
        class="flex flex-col gap-1 text-xs"
      >
        <For
          each={props.heatmap?.buckets.toReversed() ?? []}
          keyed={(b) => b.swatch}
        >
          {(b) => (
            <li class="flex items-center gap-2">
              <Swatch class={b().swatch} />
              {bucketLabel(b(), info())}
            </li>
          )}
        </For>
        <Show when={props.heatmap?.hasNoData}>
          <li class="flex items-center gap-2 text-muted-foreground">
            <Swatch class={NO_DATA.swatch} />
            No data
          </li>
        </Show>
      </ul>
      <p class="text-xs text-muted-foreground">{info().source}</p>
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
  class: string
}

function Swatch(props: SwatchProps) {
  return (
    <span
      aria-hidden="true"
      class={cn("size-3.5 shrink-0 rounded-sm border", props.class)}
    />
  )
}

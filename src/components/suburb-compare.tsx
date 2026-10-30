import ArrowLeftRightIcon from "@lucide/solid/icons/arrow-left-right"
import { createMemo, Errored, For, Loading, Show } from "solid-js"

import { SuburbMedia, useSuburbFacts } from "@/components/suburb-facts"
import { Button } from "@/components/ui/button"
import { statRank } from "@/lib/compare"
import { DETAIL_STATS, isHeatmapStat, type Overlay, STATS } from "@/lib/stats"
import { getSuburbFacts } from "@/queries/suburb-facts"
import type { Suburb } from "@/types/suburb"
import type { SuburbFacts, SuburbFactsFile } from "@/types/suburb-facts"

const NO_VALUE = "–"

type Side = "a" | "b"

// The colours of the two suburbs' outlines on the map.
const SIDE_DOT: Record<Side, string> = {
  a: "bg-foreground",
  b: "bg-map-compare",
}

interface Row {
  key: string
  label: string
  a: string
  b: string
  // Where each sits among every suburb, from 0 to 1, for stats with a range.
  rankA: number | null
  rankB: number | null
  overlay?: Overlay
}

function toRows(
  a: SuburbFacts | undefined,
  b: SuburbFacts | undefined,
  all: SuburbFactsFile,
): Row[] {
  const rows: Row[] = DETAIL_STATS.flatMap((key) => {
    const valueA = a?.stats[key] ?? null
    const valueB = b?.stats[key] ?? null

    if (valueA === null && valueB === null) {
      return []
    }

    const { label, format } = STATS[key]

    return [
      {
        key,
        label,
        a: valueA === null ? NO_VALUE : format(valueA),
        b: valueB === null ? NO_VALUE : format(valueB),
        rankA: statRank(all, key, valueA),
        rankB: statRank(all, key, valueB),
        overlay: isHeatmapStat(key) ? key : undefined,
      },
    ]
  })

  if (a?.topBirthplace || b?.topBirthplace) {
    rows.push({
      key: "birthplace",
      label: "Top birthplace",
      a: a?.topBirthplace?.country ?? NO_VALUE,
      b: b?.topBirthplace?.country ?? NO_VALUE,
      rankA: null,
      rankB: null,
      overlay: "birthplace",
    })
  }

  return rows
}

export interface SuburbCompareProps {
  a: Suburb
  b: Suburb
  overlay: Overlay | undefined
  onToggleOverlay: (overlay: Overlay) => void
  onSwap: () => void
  onStopComparing: () => void
}

// Both suburbs' photos and facts side by side, then a row per stat.
export function SuburbCompare(props: SuburbCompareProps) {
  const factsA = useSuburbFacts(() => props.a.id)
  const factsB = useSuburbFacts(() => props.b.id)

  return (
    <div class="flex flex-col gap-4">
      <div class="grid grid-cols-2 gap-3">
        <CompareHeading facts={factsA()} side="a" suburb={props.a} />
        <CompareHeading facts={factsB()} side="b" suburb={props.b} />
      </div>
      <div class="flex gap-2">
        <Button onClick={props.onSwap} size="sm" variant="outline">
          <ArrowLeftRightIcon />
          Swap
        </Button>
        <Button onClick={props.onStopComparing} size="sm" variant="ghost">
          Stop comparing
        </Button>
      </div>
      <Errored
        fallback={
          <p class="text-sm text-muted-foreground">
            The details couldn&rsquo;t load.
          </p>
        }
      >
        <Loading
          fallback={
            <div
              aria-hidden="true"
              class="h-40 animate-pulse rounded-md bg-muted"
            />
          }
        >
          <CompareRows
            a={factsA()}
            b={factsB()}
            onToggleOverlay={props.onToggleOverlay}
            overlay={props.overlay}
          />
        </Loading>
      </Errored>
    </div>
  )
}

interface CompareHeadingProps {
  suburb: Suburb
  facts: SuburbFacts | undefined
  side: Side
}

// Suburbs with no photo get a plain tile, so the two names still line up.
function CompareHeading(props: CompareHeadingProps) {
  return (
    <div class="flex min-w-0 flex-col gap-1.5">
      <SuburbMedia
        class="overflow-hidden rounded-md"
        facts={props.facts}
        name={props.suburb.name}
        placeholder={<div class="aspect-3/2 rounded-md bg-muted" />}
      />
      <h3 class="flex items-center gap-1.5 font-semibold">
        <span
          aria-hidden="true"
          class={["size-2.5 shrink-0 rounded-full", SIDE_DOT[props.side]]}
        />
        <span class="truncate">{props.suburb.name}</span>
      </h3>
      <p class="truncate text-xs text-muted-foreground">{props.suburb.lga}</p>
    </div>
  )
}

interface CompareRowsProps {
  a: SuburbFacts | undefined
  b: SuburbFacts | undefined
  overlay: Overlay | undefined
  onToggleOverlay: (overlay: Overlay) => void
}

function CompareRows(props: CompareRowsProps) {
  const all = createMemo(async () => await getSuburbFacts())
  const rows = () => toRows(props.a, props.b, all())

  return (
    <div class="flex flex-col gap-2">
      <dl class="flex flex-col">
        <For each={rows()} keyed={(r) => r.key}>
          {(row) => (
            <CompareRow
              onToggleOverlay={props.onToggleOverlay}
              row={row()}
              shown={
                row().overlay !== undefined && row().overlay === props.overlay
              }
            />
          )}
        </For>
      </dl>
      <p class="text-xs text-muted-foreground">
        Each bar runs from Sydney&rsquo;s lowest suburb to its highest.
      </p>
    </div>
  )
}

interface CompareRowProps {
  row: Row
  shown: boolean
  onToggleOverlay: (overlay: Overlay) => void
}

// Like the panel's details, the label's button covers the whole row, so
// clicking anywhere on it shows the stat on the map.
function CompareRow(props: CompareRowProps) {
  return (
    <div
      class={[
        "relative rounded-md px-2 py-1.5",
        { "hover:bg-muted": !!props.row.overlay, "bg-muted": props.shown },
      ]}
    >
      <dt class="text-xs text-muted-foreground">
        <Show fallback={props.row.label} when={props.row.overlay}>
          {(overlay) => (
            <button
              aria-label={`Show ${props.row.label} on the map`}
              aria-pressed={props.shown ? "true" : "false"}
              class="outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring"
              onClick={() => {
                props.onToggleOverlay(overlay())
              }}
              type="button"
            >
              {props.row.label}
            </button>
          )}
        </Show>
      </dt>
      <dd class="grid grid-cols-2 gap-3 text-sm font-medium">
        <span>{props.row.a}</span>
        <span>{props.row.b}</span>
      </dd>
      <Show when={props.row.rankA !== null || props.row.rankB !== null}>
        <dd
          aria-hidden="true"
          class="relative mt-1.5 mb-1 h-1 rounded-full bg-border"
        >
          <RankDot rank={props.row.rankA} side="a" />
          <RankDot rank={props.row.rankB} side="b" />
        </dd>
      </Show>
    </div>
  )
}

interface RankDotProps {
  rank: number | null
  side: Side
}

function RankDot(props: RankDotProps) {
  return (
    <Show when={props.rank !== null}>
      <span
        class={[
          "absolute top-1/2 left-(--at) size-2.5 -translate-1/2 rounded-full ring-2 ring-card",
          SIDE_DOT[props.side],
        ]}
        style={{ "--at": `${(props.rank ?? 0) * 100}%` }}
      />
    </Show>
  )
}

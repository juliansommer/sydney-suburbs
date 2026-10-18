import ChevronRightIcon from "@lucide/solid/icons/chevron-right"
import InfoIcon from "@lucide/solid/icons/info"
import { useQuery } from "@tanstack/solid-query"
import { Collapsible } from "base-ui-solid/collapsible"
import { type Accessor, createMemo, For, Match, Show, Switch } from "solid-js"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { DETAIL_STATS, isHeatmapStat, type Overlay, STATS } from "@/lib/stats"
import { cn } from "@/lib/utils"
import { suburbFactsQuery } from "@/queries/suburb-facts"
import type {
  SuburbFacts,
  SuburbPhoto,
  SuburbStats,
  TopBirthplace,
} from "@/types/suburb-facts"

const populationFormat = new Intl.NumberFormat("en-AU")

type FactsState =
  | { status: "pending" }
  | { status: "error" }
  | { status: "success"; facts: SuburbFacts | undefined }

// A failed load hides the facts, so the rest of the panel keeps working.
// Nothing is fetched until a suburb is selected; the map page prefetches.
export function useSuburbFacts(
  suburbId: Accessor<string | undefined>,
): Accessor<FactsState> {
  const query = useQuery(() => ({
    ...suburbFactsQuery,
    enabled: suburbId() !== undefined,
  }))
  return createMemo((): FactsState => {
    const id = suburbId()
    if (query.isSuccess && id !== undefined) {
      return { status: "success", facts: query.data[id] }
    }
    return query.isError ? { status: "error" } : { status: "pending" }
  })
}

function factsOf(state: FactsState): SuburbFacts | undefined {
  return state.status === "success" ? state.facts : undefined
}

interface SuburbMediaProps {
  state: FactsState
  name: string
  class?: string
}

// The photo at the top of the panel, or a skeleton of the same size while the
// facts load. Suburbs without a photo skip it entirely.
export function SuburbMedia(props: SuburbMediaProps) {
  return (
    <Switch>
      <Match when={props.state.status === "pending"}>
        <div
          aria-hidden="true"
          class={cn("aspect-3/2 animate-pulse bg-muted", props.class)}
          data-testid="photo-skeleton"
        />
      </Match>
      <Match when={factsOf(props.state)?.photo}>
        {(photo) => (
          <Photo class={props.class} name={props.name} photo={photo()} />
        )}
      </Match>
    </Switch>
  )
}

interface PhotoProps {
  photo: SuburbPhoto
  name: string
  class?: string
}

function Photo(props: PhotoProps) {
  return (
    <div class={cn("relative", props.class)}>
      {/* Grey until it loads; transparent text keeps the alt from flashing up. */}
      <img
        alt={props.name}
        class="aspect-3/2 w-full bg-muted object-cover text-transparent"
        decoding="async"
        height={props.photo.height}
        src={props.photo.url}
        width={props.photo.width}
      />
      <PhotoCredit photo={props.photo} />
    </div>
  )
}

interface PhotoCreditProps {
  photo: SuburbPhoto
}

// Opens on hover with a mouse and on tap with touch.
function PhotoCredit(props: PhotoCreditProps) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Photo credit"
        class="absolute right-2 bottom-2 grid size-7 place-items-center"
        openOnHover
      >
        <InfoIcon class="size-4 text-black" />
      </PopoverTrigger>
      <PopoverContent align="end" class="w-64" side="left">
        <div class="flex flex-col gap-1 text-xs">
          <p>
            Photo by <span class="font-medium">{props.photo.artist}</span>
          </p>
          <p class="text-muted-foreground">
            <a
              class="hover:underline"
              href={props.photo.licenceUrl}
              rel="noreferrer"
              target="_blank"
            >
              {props.photo.licence}
            </a>
            {" · "}
            <a
              class="hover:underline"
              href={props.photo.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              Wikimedia Commons
            </a>
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface FactsRowProps {
  state: FactsState
}

// "Postcode 2042 · 15,301 people". Places with nobody living there, like
// industrial areas, leave the population out rather than saying "0 people".
export function FactsRow(props: FactsRowProps) {
  const parts = () => {
    const facts = factsOf(props.state)
    return [
      facts?.postcode ? `Postcode ${facts.postcode}` : null,
      facts?.population
        ? `${populationFormat.format(facts.population)} people`
        : null,
    ].filter((part) => part !== null)
  }
  return (
    <Switch>
      <Match when={props.state.status === "pending"}>
        <div
          aria-hidden="true"
          class="mt-1 h-4 w-40 animate-pulse rounded bg-muted"
          data-testid="facts-skeleton"
        />
      </Match>
      <Match when={parts().length > 0}>
        <p class="text-sm text-muted-foreground">{parts().join(" · ")}</p>
      </Match>
    </Switch>
  )
}

interface SummaryProps {
  state: FactsState
}

export function Summary(props: SummaryProps) {
  return (
    <Show when={factsOf(props.state)?.summary}>
      {(summary) => <p class="text-sm">{summary()}</p>}
    </Show>
  )
}

interface Detail {
  key: string
  label: string
  value: string
  // What clicking it puts on the map, if anything.
  overlay?: Overlay
  overlayName?: string
}

const percentFormat = new Intl.NumberFormat("en-AU", {
  maximumFractionDigits: 1,
})

// Census figures are missing where too few people live, so those are skipped.
function toDetails(
  stats: SuburbStats,
  topBirthplace: TopBirthplace | null,
): Detail[] {
  const details: Detail[] = DETAIL_STATS.flatMap((key) => {
    const value = stats[key]
    if (value === null) {
      return []
    }
    const { label, format } = STATS[key]
    const detail: Detail = { key, label, value: format(value) }
    if (isHeatmapStat(key)) {
      detail.overlay = key
      detail.overlayName = `${label} heatmap`
    }
    return [detail]
  })
  if (topBirthplace) {
    details.push({
      key: "birthplace",
      label: "Top birthplace",
      value: `${topBirthplace.country} · ${percentFormat.format(topBirthplace.percent)}%`,
      overlay: "birthplace",
      overlayName: "birthplace map",
    })
  }
  return details
}

interface MoreDetailsProps {
  state: FactsState
  // What the map is showing from the panel, if anything.
  overlay: Overlay | undefined
  onToggleOverlay: (overlay: Overlay) => void
}

// Closed by default, so the panel stays short until someone wants the numbers.
// Details with a map overlay show it when clicked, and hide it when clicked
// again.
export function MoreDetails(props: MoreDetailsProps) {
  return (
    <Show when={factsOf(props.state)}>
      {(facts) => (
        <Collapsible.Root>
          <Collapsible.Trigger class="group flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ChevronRightIcon class="size-4 transition-transform group-data-panel-open:rotate-90" />
            More details
          </Collapsible.Trigger>
          <Collapsible.Panel>
            <dl class="grid grid-cols-2 gap-x-2 gap-y-1 pt-3">
              <For
                each={toDetails(facts().stats, facts().topBirthplace)}
                keyed={(d) => d.key}
              >
                {(detail) => (
                  <DetailCell
                    detail={detail()}
                    onToggleOverlay={props.onToggleOverlay}
                    shown={
                      detail().overlay !== undefined &&
                      detail().overlay === props.overlay
                    }
                  />
                )}
              </For>
            </dl>
          </Collapsible.Panel>
        </Collapsible.Root>
      )}
    </Show>
  )
}

interface DetailCellProps {
  detail: Detail
  shown: boolean
  onToggleOverlay: (overlay: Overlay) => void
}

// The label's button stretches over the whole cell, so the value is part of
// the click target too.
function DetailCell(props: DetailCellProps) {
  return (
    <div
      class={[
        "relative rounded-md px-2 py-1",
        { "hover:bg-muted": !!props.detail.overlay, "bg-muted": props.shown },
      ]}
    >
      <dt class="text-xs text-muted-foreground">
        <Show fallback={props.detail.label} when={props.detail.overlay}>
          {(overlay) => (
            <button
              aria-label={`Show ${props.detail.overlayName}`}
              aria-pressed={props.shown ? "true" : "false"}
              class="outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring"
              onClick={() => {
                props.onToggleOverlay(overlay())
              }}
              type="button"
            >
              {props.detail.label}
            </button>
          )}
        </Show>
      </dt>
      <dd class="text-sm font-medium">{props.detail.value}</dd>
    </div>
  )
}

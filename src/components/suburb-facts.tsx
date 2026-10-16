import { Collapsible } from "@base-ui/react/collapsible"
import { useQuery } from "@tanstack/react-query"
import { ChevronRightIcon, InfoIcon } from "lucide-react"

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
export function useSuburbFacts(suburbId: string | undefined): FactsState {
  const { data, status } = useQuery({
    ...suburbFactsQuery,
    enabled: suburbId !== undefined,
  })
  if (status === "success" && suburbId !== undefined) {
    return { status, facts: data[suburbId] }
  }
  return status === "error" ? { status } : { status: "pending" }
}

interface SuburbMediaProps {
  state: FactsState
  name: string
  className?: string
}

// The photo at the top of the panel, or a skeleton of the same size while the
// facts load. Suburbs without a photo skip it entirely.
export function SuburbMedia({ state, name, className }: SuburbMediaProps) {
  if (state.status === "error") {
    return null
  }
  if (state.status === "pending") {
    return (
      <div
        aria-hidden
        className={cn("aspect-3/2 animate-pulse bg-muted", className)}
        data-testid="photo-skeleton"
      />
    )
  }
  const photo = state.facts?.photo
  if (!photo) {
    return null
  }
  return <Photo className={className} name={name} photo={photo} />
}

interface PhotoProps {
  photo: SuburbPhoto
  name: string
  className?: string
}

function Photo({ photo, name, className }: PhotoProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Grey until it loads; transparent text keeps the alt from flashing up. */}
      <img
        alt={name}
        className="aspect-3/2 w-full bg-muted object-cover text-transparent"
        decoding="async"
        height={photo.height}
        src={photo.url}
        width={photo.width}
      />
      <PhotoCredit photo={photo} />
    </div>
  )
}

interface PhotoCreditProps {
  photo: SuburbPhoto
}

// Opens on hover with a mouse and on tap with touch.
function PhotoCredit({ photo }: PhotoCreditProps) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Photo credit"
        className="absolute right-2 bottom-2 grid size-7 place-items-center"
        openOnHover
      >
        <InfoIcon className="size-4 text-black" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64" side="left">
        <div className="flex flex-col gap-1 text-xs">
          <p>
            Photo by <span className="font-medium">{photo.artist}</span>
          </p>
          <p className="text-muted-foreground">
            <a
              className="hover:underline"
              href={photo.licenceUrl}
              rel="noreferrer"
              target="_blank"
            >
              {photo.licence}
            </a>
            {" · "}
            <a
              className="hover:underline"
              href={photo.sourceUrl}
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
export function FactsRow({ state }: FactsRowProps) {
  if (state.status === "pending") {
    return (
      <div
        aria-hidden
        className="mt-1 h-4 w-40 animate-pulse rounded bg-muted"
        data-testid="facts-skeleton"
      />
    )
  }
  const facts = state.status === "success" ? state.facts : undefined
  const parts = [
    facts?.postcode ? `Postcode ${facts.postcode}` : null,
    facts?.population
      ? `${populationFormat.format(facts.population)} people`
      : null,
  ].filter((part) => part !== null)
  if (parts.length === 0) {
    return null
  }
  return <p className="text-sm text-muted-foreground">{parts.join(" · ")}</p>
}

interface SummaryProps {
  state: FactsState
}

export function Summary({ state }: SummaryProps) {
  const facts = state.status === "success" ? state.facts : undefined
  if (!facts?.summary) {
    return null
  }
  return <p className="text-sm">{facts.summary}</p>
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
export function MoreDetails({
  state,
  overlay,
  onToggleOverlay,
}: MoreDetailsProps) {
  if (state.status !== "success" || !state.facts) {
    return null
  }
  const details = toDetails(state.facts.stats, state.facts.topBirthplace)
  return (
    <Collapsible.Root>
      <Collapsible.Trigger className="group flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronRightIcon className="size-4 transition-transform group-data-panel-open:rotate-90" />
        More details
      </Collapsible.Trigger>
      <Collapsible.Panel>
        <dl className="grid grid-cols-2 gap-x-2 gap-y-1 pt-3">
          {details.map((detail) => (
            <DetailCell
              detail={detail}
              key={detail.key}
              onToggleOverlay={onToggleOverlay}
              shown={detail.overlay !== undefined && detail.overlay === overlay}
            />
          ))}
        </dl>
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}

interface DetailCellProps {
  detail: Detail
  shown: boolean
  onToggleOverlay: (overlay: Overlay) => void
}

// The label's button stretches over the whole cell, so the value is part of
// the click target too.
function DetailCell({ detail, shown, onToggleOverlay }: DetailCellProps) {
  const { overlay } = detail
  return (
    <div
      className={cn(
        "relative rounded-md px-2 py-1",
        overlay && "hover:bg-muted",
        shown && "bg-muted",
      )}
    >
      <dt className="text-xs text-muted-foreground">
        {overlay ? (
          <button
            aria-label={`Show ${detail.overlayName}`}
            aria-pressed={shown}
            className="outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring"
            onClick={() => {
              onToggleOverlay(overlay)
            }}
            type="button"
          >
            {detail.label}
          </button>
        ) : (
          detail.label
        )}
      </dt>
      <dd className="text-sm font-medium">{detail.value}</dd>
    </div>
  )
}

import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { InfoIcon } from "lucide-react"
import type { CSSProperties } from "react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { suburbFactsQuery } from "@/queries/suburb-facts"
import type { SuburbFacts, SuburbPhoto } from "@/types/suburb-facts"

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

type PlaceholderStyle = CSSProperties & Record<"--photo-color", string>

function Photo({ photo, name, className }: PhotoProps) {
  const placeholder: PlaceholderStyle = { "--photo-color": photo.color }
  return (
    <div className={cn("relative", className)}>
      <img
        alt={name}
        className="aspect-3/2 w-full bg-(--photo-color) object-cover"
        decoding="async"
        height={photo.height}
        src={photo.url}
        // The photo's average colour shows until it loads.
        style={placeholder}
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

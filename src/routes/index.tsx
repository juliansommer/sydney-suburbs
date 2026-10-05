import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  lazy,
  type ReactNode,
  type RefObject,
  Suspense,
  useEffect,
  useEffectEvent,
  useRef,
} from "react"
import { z } from "zod/mini"

import { CouncilProgressButton } from "@/components/council-progress"
import { SuburbMap, type SuburbMapHandle } from "@/components/map/suburb-map"
import { SuburbSearch } from "@/components/map/suburb-search"
import { NrlLegend } from "@/components/nrl-legend"
import { Button, buttonVariants } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { whenIdle } from "@/lib/idle"
import { mySuburbsKey, mySuburbsQuery } from "@/queries/my-suburbs"
import { nrlLayersQuery } from "@/queries/nrl-layers"
import { suburbFactsQuery } from "@/queries/suburb-facts"
import { suburbsTopoQuery } from "@/queries/suburbs-topo"
import type { MapLayers } from "@/types/map-layers"
import type { SuburbMapData, SuburbProperties } from "@/types/suburb"
import type { UserSuburb } from "@/types/user-suburb"

// The panel stays hidden until a suburb is picked, so it loads in its own
// chunk once the map renders.
const SuburbPanel = lazy(async () => {
  const { SuburbPanel: component } = await import("@/components/suburb-panel")
  return { default: component }
})

// Suburb ids are ABS SAL codes, all 5-digit numbers, so the URL carries a
// number. A malformed one is just no selection.
const suburbParam = z.int()

const MAP_MODES = ["visited", "nrl"] as const
type MapMode = (typeof MAP_MODES)[number]
// Visited is the default, so it stays out of the URL.
const modeParam = z.enum(MAP_MODES)

const MODE_LABELS: Record<MapMode, string> = { visited: "Visited", nrl: "NRL" }

const NO_LAYERS: MapLayers = { fills: [], outlines: [], markers: [] }

interface MapSearch {
  suburb?: number
  mode?: MapMode
}

export const Route = createFileRoute("/")({
  validateSearch: (search): MapSearch => {
    const mode = modeParam.safeParse(search.mode).data
    return {
      suburb: suburbParam.safeParse(search.suburb).data,
      mode: mode === "visited" ? undefined : mode,
    }
  },
  component: MapPage,
})

type Rows = ReadonlyMap<string, UserSuburb>

function MapPage() {
  const { mode } = Route.useSearch()
  const { data, isError } = useQuery(suburbsTopoQuery)
  const { data: session, isPending } = authClient.useSession()
  const { data: rows } = useQuery({ ...mySuburbsQuery, enabled: !!session })
  const map = useRef<SuburbMapHandle>(null)
  const suburbs = data?.suburbs.map((s) => s.properties) ?? []
  const visitedIds = new Set(
    [...(rows?.values() ?? [])]
      .filter((row) => row.visited)
      .map((row) => row.suburbId),
  )

  return (
    <main className="relative h-dvh overflow-hidden bg-map-water">
      {isError ? (
        <p className="grid h-full place-items-center text-muted-foreground">
          The map couldn&rsquo;t load. Try refreshing.
        </p>
      ) : null}
      {data ? (
        <MapView
          data={data}
          map={map}
          rows={rows}
          signedIn={!!session}
          suburbs={suburbs}
          visitedIds={visitedIds}
        />
      ) : null}
      <h1 className="pointer-events-none absolute top-4 left-4 text-lg font-semibold">
        Sydney Suburbs
      </h1>
      <header className="absolute top-4 right-4">
        {isPending ? null : (
          <Account signedIn={!!session}>
            {rows && data && mode !== "nrl" ? (
              <CouncilProgressButton
                onZoom={(lga) => {
                  map.current?.zoomToCouncil(lga)
                }}
                suburbs={suburbs}
                visitedIds={visitedIds}
              />
            ) : null}
          </Account>
        )}
      </header>
    </main>
  )
}

interface MapViewProps {
  data: SuburbMapData
  map: RefObject<SuburbMapHandle | null>
  suburbs: SuburbProperties[]
  visitedIds: ReadonlySet<string>
  signedIn: boolean
  rows: Rows | undefined
}

function MapView({
  data,
  map,
  suburbs,
  visitedIds,
  signedIn,
  rows,
}: MapViewProps) {
  const { suburb: selectedId, mode = "visited" } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: nrlLayers } = useQuery({
    ...nrlLayersQuery,
    enabled: mode === "nrl",
  })
  const layers: MapLayers =
    mode === "nrl"
      ? (nrlLayers ?? NO_LAYERS)
      : {
          fills: [
            { key: "visited", ids: visitedIds, className: "fill-map-visited" },
          ],
          outlines: [],
          markers: [],
        }

  const byId = new Map(suburbs.map((s) => [s.id, s]))
  // An id the map doesn't draw is no selection at all.
  const selected =
    selectedId === undefined ? undefined : byId.get(String(selectedId))

  function select(id: string | null) {
    if (id === (selected?.id ?? null)) {
      return
    }
    // Switching suburbs replaces the entry, so Back leaves the map rather
    // than stepping through every suburb looked at.
    navigate({
      search: (prev) => ({ ...prev, suburb: id ? Number(id) : undefined }),
      replace: !!selected && !!id,
    })
  }

  function switchMode(next: MapMode) {
    navigate({
      search: (prev) => ({
        ...prev,
        mode: next === "visited" ? undefined : next,
      }),
      replace: true,
    })
  }

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const { target } = event
    const typing =
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLInputElement
    if (event.key === "Escape" && !typing) {
      select(null)
    }
  })
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  // The map has rendered by now, so fetch facts when the browser is idle and
  // they never compete with it. A deep link's panel fetches them right away.
  const queryClient = useQueryClient()
  useEffect(
    () =>
      whenIdle(async () => {
        try {
          await queryClient.query(suburbFactsQuery)
        } catch {
          // The query keeps the error, and the panel handles it.
        }
      }),
    [queryClient],
  )

  return (
    <>
      <SuburbMap
        data={data}
        layers={layers}
        onSelect={select}
        ref={map}
        selectedId={selected?.id ?? null}
      />
      <div className="absolute bottom-4 left-4 flex flex-col items-start gap-2">
        {mode === "nrl" ? <NrlLegend /> : null}
        <ModeSwitch mode={mode} onSwitch={switchMode} />
      </div>
      <div className="absolute inset-x-4 top-14 md:right-auto md:w-72">
        <SuburbSearch
          onPick={(id) => {
            select(id)
            map.current?.zoomTo(id)
          }}
          suburbs={suburbs}
          visitedIds={visitedIds}
        />
      </div>
      <Suspense>
        <SuburbPanel
          onClose={() => {
            select(null)
          }}
          onZoomToCouncil={(lga) => {
            map.current?.zoomToCouncil(lga)
          }}
          rows={rows}
          signedIn={signedIn}
          suburb={selected}
        />
      </Suspense>
    </>
  )
}

interface ModeSwitchProps {
  mode: MapMode
  onSwitch: (mode: MapMode) => void
}

function ModeSwitch({ mode, onSwitch }: ModeSwitchProps) {
  return (
    <fieldset className="flex gap-1 rounded-lg border bg-background p-0.5 shadow-sm">
      <legend className="sr-only">Map mode</legend>
      {MAP_MODES.map((m) => (
        <Button
          aria-pressed={m === mode}
          key={m}
          onClick={() => {
            onSwitch(m)
          }}
          size="sm"
          variant={m === mode ? "secondary" : "ghost"}
        >
          {MODE_LABELS[m]}
        </Button>
      ))}
    </fieldset>
  )
}

interface AccountProps {
  signedIn: boolean
  // Shown beside Sign out, e.g. the progress counter.
  children?: ReactNode
}

function Account({ signedIn, children }: AccountProps) {
  const queryClient = useQueryClient()

  if (!signedIn) {
    return (
      <Link className={buttonVariants()} to="/login">
        Sign in
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {children}
      <Button
        onClick={async () => {
          await authClient.signOut()
          // Disabled queries keep their data, so drop it or the next person
          // on this browser would see these visits.
          queryClient.removeQueries({ queryKey: mySuburbsKey })
        }}
        variant="outline"
      >
        Sign out
      </Button>
    </div>
  )
}

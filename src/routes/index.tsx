import type { JSX } from "@solidjs/web"
import { useQuery, useQueryClient } from "@tanstack/solid-query"
import { createFileRoute, Link } from "@tanstack/solid-router"
import { createMemo, For, lazy, Loading, onSettled, Show } from "solid-js"
import { z } from "zod/mini"

import { HeatmapLegend } from "@/components/heatmap-legend"
import { GitHubLogo } from "@/components/logos"
import { SearchPlaceholder } from "@/components/map/search-placeholder"
import { SuburbMap, type SuburbMapHandle } from "@/components/map/suburb-map"
import { Button, buttonVariants } from "@/components/ui/button"
import { useShortcut } from "@/hooks/use-shortcut"
import { sessionQuery, signOut } from "@/lib/auth"
import { whenIdle } from "@/lib/idle"
import {
  DEFAULT_HEATMAP_STAT,
  HEATMAP_STATS,
  type HeatmapStat,
  type Overlay,
} from "@/lib/stats"
import { birthplaceQuery } from "@/queries/birthplace"
import { heatmapQuery } from "@/queries/heatmap"
import { mySuburbsQuery } from "@/queries/my-suburbs"
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

// The search box's combobox and the signed-in progress popover are most of
// the map chunk, so they load after it rather than delaying the first draw.
const SuburbSearch = lazy(async () => {
  const { SuburbSearch: component } =
    await import("@/components/map/suburb-search")
  return { default: component }
})
const CouncilProgressButton = lazy(async () => {
  const { CouncilProgressButton: component } =
    await import("@/components/council-progress")
  return { default: component }
})

// The flags and club logos load with their mode rather than with the map.
const BirthplaceLegend = lazy(async () => {
  const { BirthplaceLegend: component } =
    await import("@/components/birthplace-legend")
  return { default: component }
})
const NrlLegend = lazy(async () => {
  const { NrlLegend: component } = await import("@/components/nrl-legend")
  return { default: component }
})

// Suburb ids are ABS SAL codes, all 5-digit numbers, so the URL carries a
// number. A malformed one is just no selection.
const suburbParam = z.int()

const MAP_MODES = ["visited", "heatmap", "birthplace", "nrl"] as const
type MapMode = (typeof MAP_MODES)[number]
// Visited is the default, so it stays out of the URL.
const modeParam = z.enum(MAP_MODES)
// Only the heatmap mode has a stat, and the default one stays out of the URL.
const statParam = z.enum(HEATMAP_STATS)

const MODE_LABELS: Record<MapMode, string> = {
  visited: "Visited",
  nrl: "NRL",
  heatmap: "Heatmap",
  birthplace: "Birthplace",
}

const NO_LAYERS: MapLayers = { fills: [], outlines: [], markers: [] }

interface MapSearch {
  suburb?: number
  mode?: MapMode
  stat?: HeatmapStat
}

export const Route = createFileRoute("/")({
  validateSearch: (search): MapSearch => {
    const mode = modeParam.safeParse(search.mode).data
    const stat = statParam.safeParse(search.stat).data
    return {
      suburb: suburbParam.safeParse(search.suburb).data,
      mode: mode === "visited" ? undefined : mode,
      stat:
        mode === "heatmap" && stat !== DEFAULT_HEATMAP_STAT ? stat : undefined,
    }
  },
  component: MapPage,
})

type Rows = ReadonlyMap<string, UserSuburb>

function MapPage() {
  const search = Route.useSearch()
  const topo = useQuery(() => suburbsTopoQuery)
  const session = useQuery(() => sessionQuery)
  const signedIn = () => session.isSuccess && !!session.data
  const rowsQuery = useQuery(() => ({
    ...mySuburbsQuery,
    enabled: signedIn(),
  }))
  // Checked first, as reading data before it's there would suspend.
  const data = () => (topo.isSuccess ? topo.data : undefined)
  const rows = () => (rowsQuery.isSuccess ? rowsQuery.data : undefined)
  let map: SuburbMapHandle | undefined
  const suburbs = createMemo(
    () => data()?.suburbs.map((s) => s.properties) ?? [],
  )
  const visitedIds = createMemo(
    () =>
      new Set(
        [...(rows()?.values() ?? [])]
          .filter((row) => row.visited)
          .map((row) => row.suburbId),
      ),
  )

  return (
    <main class="relative h-dvh overflow-hidden bg-map-water">
      <Show when={topo.isError}>
        <p class="grid h-full place-items-center text-muted-foreground">
          The map couldn&rsquo;t load. Try refreshing.
        </p>
      </Show>
      <Show when={data()}>
        {(loaded) => (
          <MapView
            data={loaded()}
            mapRef={(handle) => {
              map = handle
            }}
            rows={rows()}
            signedIn={signedIn()}
            suburbs={suburbs()}
            visitedIds={visitedIds()}
          />
        )}
      </Show>
      <h1 class="pointer-events-none absolute top-4 left-4 text-lg font-semibold">
        Sydney Suburbs
      </h1>
      <header class="absolute top-4 right-4 flex items-center gap-2">
        <a
          aria-label="Source on GitHub"
          class={buttonVariants({ size: "icon", variant: "ghost" })}
          href="https://github.com/juliansommer/sydney-suburbs"
          rel="noreferrer"
          target="_blank"
        >
          <GitHubLogo />
        </a>
        <Show when={!session.isPending}>
          <Account signedIn={signedIn()}>
            <Loading>
              <Show when={rows() && data() && search().mode === undefined}>
                <CouncilProgressButton
                  onZoom={(lga) => {
                    map?.zoomToCouncil(lga)
                  }}
                  suburbs={suburbs()}
                  visitedIds={visitedIds()}
                />
              </Show>
            </Loading>
          </Account>
        </Show>
      </header>
    </main>
  )
}

interface MapViewProps {
  data: SuburbMapData
  mapRef: (handle: SuburbMapHandle) => void
  suburbs: SuburbProperties[]
  visitedIds: ReadonlySet<string>
  signedIn: boolean
  rows: Rows | undefined
}

function MapView(props: MapViewProps) {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const mode = (): MapMode => search().mode ?? "visited"
  const stat = (): HeatmapStat => search().stat ?? DEFAULT_HEATMAP_STAT
  let map: SuburbMapHandle | undefined

  const nrlQuery = useQuery(() => ({
    ...nrlLayersQuery,
    enabled: mode() === "nrl",
  }))
  const heatmap = useQuery(() => ({
    ...heatmapQuery(stat()),
    enabled: mode() === "heatmap",
  }))
  const birthplace = useQuery(() => ({
    ...birthplaceQuery,
    enabled: mode() === "birthplace",
  }))
  const heatmapData = () => (heatmap.isSuccess ? heatmap.data : undefined)

  // Functions, so only the current mode's query is read.
  const layersByMode: Record<MapMode, () => MapLayers> = {
    visited: () => ({
      fills: [
        {
          key: "visited",
          ids: props.visitedIds,
          className: "fill-map-visited",
        },
      ],
      outlines: [],
      markers: [],
    }),
    nrl: () => (nrlQuery.isSuccess ? nrlQuery.data : NO_LAYERS),
    heatmap: () => heatmapData()?.layers ?? NO_LAYERS,
    birthplace: () => (birthplace.isSuccess ? birthplace.data : NO_LAYERS),
  }
  const layers = () => layersByMode[mode()]()
  const overlayByMode: Record<MapMode, () => Overlay | undefined> = {
    visited: () => undefined,
    nrl: () => undefined,
    heatmap: stat,
    birthplace: () => "birthplace",
  }
  const overlay = () => overlayByMode[mode()]()

  const byId = createMemo(() => new Map(props.suburbs.map((s) => [s.id, s])))
  // An id the map doesn't draw is no selection at all.
  const selected = () => {
    const id = search().suburb
    return id === undefined ? undefined : byId().get(String(id))
  }

  function select(id: string | null) {
    const current = selected()
    if (id === (current?.id ?? null)) {
      return
    }
    // Switching suburbs replaces the entry, so Back leaves the map rather
    // than stepping through every suburb looked at.
    void navigate({
      search: (prev) => ({ ...prev, suburb: id ? Number(id) : undefined }),
      replace: !!current && !!id,
    })
  }

  function switchMode(next: MapMode) {
    void navigate({
      search: (prev) => ({
        ...prev,
        mode: next === "visited" ? undefined : next,
      }),
      replace: true,
    })
  }

  function showHeatmap(next: HeatmapStat) {
    void navigate({
      search: (prev) => ({ ...prev, mode: "heatmap", stat: next }),
      replace: true,
    })
  }

  // Picking what's already on the map goes back to the visited mode.
  function toggleOverlay(next: Overlay) {
    if (next === overlay()) {
      switchMode("visited")
    } else if (next === "birthplace") {
      switchMode("birthplace")
    } else {
      showHeatmap(next)
    }
  }

  useShortcut("Escape", () => {
    select(null)
  })

  // The map has rendered by now, so fetch facts when the browser is idle and
  // they never compete with it. A deep link's panel fetches them right away.
  const queryClient = useQueryClient()
  onSettled(() =>
    whenIdle(async () => {
      try {
        await queryClient.fetchQuery(suburbFactsQuery)
      } catch {
        // The query keeps the error, and the panel handles it.
      }
    }),
  )

  return (
    <>
      <SuburbMap
        data={props.data}
        layers={layers()}
        onSelect={select}
        ref={(handle) => {
          map = handle
          props.mapRef(handle)
        }}
        selectedId={selected()?.id ?? null}
      />
      <div class="absolute bottom-4 left-4 flex flex-col items-start gap-2">
        <Loading>
          <Show when={mode() === "nrl"}>
            <NrlLegend />
          </Show>
        </Loading>
        <Show when={mode() === "heatmap"}>
          <HeatmapLegend
            heatmap={heatmapData()}
            onStatChange={showHeatmap}
            stat={stat()}
          />
        </Show>
        <Loading>
          <Show when={mode() === "birthplace"}>
            <BirthplaceLegend />
          </Show>
        </Loading>
        <ModeSwitch mode={mode()} onSwitch={switchMode} />
      </div>
      <div class="absolute inset-x-4 top-14 md:right-auto md:w-72">
        <Loading fallback={<SearchPlaceholder />}>
          <SuburbSearch
            onPick={(id) => {
              select(id)
              map?.zoomTo(id)
            }}
            suburbs={props.suburbs}
            visitedIds={props.visitedIds}
          />
        </Loading>
      </div>
      <Loading>
        <SuburbPanel
          onClose={() => {
            select(null)
          }}
          onToggleOverlay={toggleOverlay}
          onZoomToCouncil={(lga) => {
            map?.zoomToCouncil(lga)
          }}
          overlay={overlay()}
          rows={props.rows}
          signedIn={props.signedIn}
          suburb={selected()}
        />
      </Loading>
    </>
  )
}

interface ModeSwitchProps {
  mode: MapMode
  onSwitch: (mode: MapMode) => void
}

function ModeSwitch(props: ModeSwitchProps) {
  return (
    <fieldset class="flex gap-1 rounded-lg border bg-background p-0.5 shadow-sm">
      <legend class="sr-only">Map mode</legend>
      <For each={MAP_MODES}>
        {(m) => (
          <Button
            aria-pressed={m === props.mode ? "true" : "false"}
            onClick={() => {
              props.onSwitch(m)
            }}
            size="sm"
            variant={m === props.mode ? "secondary" : "ghost"}
          >
            {MODE_LABELS[m]}
          </Button>
        )}
      </For>
    </fieldset>
  )
}

interface AccountProps {
  signedIn: boolean
  // Shown beside Sign out, e.g. the progress counter.
  children?: JSX.Element
}

function Account(props: AccountProps) {
  return (
    <Show
      fallback={
        <Link class={buttonVariants()} to="/login">
          Sign in
        </Link>
      }
      when={props.signedIn}
    >
      <div class="flex items-center gap-2 text-sm">
        {props.children}
        <Button
          onClick={async () => {
            await signOut()
            // A full load wipes the query cache, so the next person on this
            // browser can't see these visits, and nothing refetches into a 401.
            window.location.assign("/")
          }}
          variant="outline"
        >
          Sign out
        </Button>
      </div>
    </Show>
  )
}

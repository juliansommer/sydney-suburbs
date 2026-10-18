import { useSearchParams } from "@solidjs/router"
import type { JSX } from "@solidjs/web"
import {
  createEffect,
  createMemo,
  Errored,
  For,
  lazy,
  Loading,
  onSettled,
  Show,
} from "solid-js"

import { HeatmapLegend } from "@/components/heatmap-legend"
import { GitHubLogo } from "@/components/logos"
import { SearchPlaceholder } from "@/components/map/search-placeholder"
import { SuburbMap, type SuburbMapHandle } from "@/components/map/suburb-map"
import { Button, buttonVariants } from "@/components/ui/button"
import { useShortcut } from "@/hooks/use-shortcut"
import { getSession, signOut } from "@/lib/auth"
import type { Heatmap } from "@/lib/heatmap"
import { whenIdle } from "@/lib/idle"
import {
  DEFAULT_HEATMAP_STAT,
  HEATMAP_STATS,
  type HeatmapStat,
  type Overlay,
} from "@/lib/stats"
import { getBirthplace } from "@/queries/birthplace"
import { getHeatmap } from "@/queries/heatmap"
import { createMySuburbs, MySuburbsContext } from "@/queries/my-suburbs"
import { getNrlLayers } from "@/queries/nrl-layers"
import { getSuburbFacts } from "@/queries/suburb-facts"
import { getSuburbsTopo } from "@/queries/suburbs-topo"
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

const MAP_MODES = ["visited", "heatmap", "birthplace", "nrl"] as const
type MapMode = (typeof MAP_MODES)[number]

type SearchValue = string | string[] | undefined

// The URL is only read through these, so anything unknown in it is just the
// default.
function parseMode(value: SearchValue): MapMode {
  return MAP_MODES.find((m) => m === value) ?? "visited"
}

function parseStat(value: SearchValue): HeatmapStat {
  return HEATMAP_STATS.find((s) => s === value) ?? DEFAULT_HEATMAP_STAT
}

// Suburb ids are ABS SAL codes, all 5-digit numbers. A malformed one is just
// no selection.
function parseSuburbId(value: SearchValue): string | undefined {
  const single = Array.isArray(value) ? undefined : value
  return single !== undefined && /^\d+$/.test(single) ? single : undefined
}

// The map's search params. Visited is the default mode and only the heatmap
// has a stat, so neither the default mode nor the default stat goes in the URL.
function useMapSearch() {
  const [search, setSearch] = useSearchParams()
  const mode = () => parseMode(search.mode)
  const stat = () => parseStat(search.stat)
  const suburbId = () => parseSuburbId(search.suburb)

  // Tidies the URL down to what's on the map.
  createEffect(
    () => {
      const tidy = {
        suburb: suburbId(),
        mode: mode() === "visited" ? undefined : mode(),
        stat:
          mode() === "heatmap" && stat() !== DEFAULT_HEATMAP_STAT
            ? stat()
            : undefined,
      }
      const untidy =
        search.suburb !== tidy.suburb ||
        search.mode !== tidy.mode ||
        search.stat !== tidy.stat
      return untidy ? tidy : undefined
    },
    (tidy) => {
      if (tidy) {
        setSearch(tidy, { replace: true })
      }
    },
  )

  return { mode, stat, suburbId, setSearch }
}

type MapSearch = ReturnType<typeof useMapSearch>

const MODE_LABELS: Record<MapMode, string> = {
  visited: "Visited",
  nrl: "NRL",
  heatmap: "Heatmap",
  birthplace: "Birthplace",
}

const NO_LAYERS: MapLayers = { fills: [], outlines: [], markers: [] }
const NO_IDS: ReadonlySet<string> = new Set()

// Filled in by the map once it's drawn, for the header and panel to zoom it.
interface MapHandleRef {
  current?: SuburbMapHandle
}

function sameIds(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((id) => b.has(id))
}

function visitedIdsOf(rows: readonly UserSuburb[]): ReadonlySet<string> {
  return new Set(rows.filter((row) => row.visited).map((row) => row.suburbId))
}

// An overlay that can't load leaves the map plain instead of taking it down.
async function unlessFailed<T>(work: Promise<T>): Promise<T | undefined> {
  try {
    return await work
  } catch {
    return undefined
  }
}

export default function MapPage() {
  const search = useMapSearch()
  const session = createMemo(async () => await getSession())
  const signedIn = () => !!session()
  const mySuburbs = createMySuburbs(signedIn)
  const [rows] = mySuburbs
  const topo = createMemo(async () => await getSuburbsTopo())
  const map: MapHandleRef = {}
  const suburbs = createMemo(() => topo().suburbs.map((s) => s.properties))
  // Waits for the rows, for the counter. A notes save changes the rows but not
  // what's visited.
  const visitedIds = createMemo(() => visitedIdsOf(rows), { equals: sameIds })
  // The map draws without waiting, and fills in visits once they load.
  const mapVisitedIds = createMemo(() => visitedIds(), {
    loadingValue: NO_IDS,
  })

  return (
    <MySuburbsContext value={mySuburbs}>
      <main class="relative h-dvh overflow-hidden bg-map-water">
        <Errored
          fallback={
            <p class="grid h-full place-items-center text-muted-foreground">
              The map couldn&rsquo;t load. Try refreshing.
            </p>
          }
        >
          <Loading>
            <MapView
              data={topo()}
              map={map}
              search={search}
              signedIn={signedIn()}
              suburbs={suburbs()}
              visitedIds={mapVisitedIds()}
            />
          </Loading>
        </Errored>
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
          <Loading>
            <Account signedIn={signedIn()}>
              <Errored fallback={null}>
                <Loading>
                  <Show when={search.mode() === "visited"}>
                    <CouncilProgressButton
                      onZoom={(lga) => {
                        map.current?.zoomToCouncil(lga)
                      }}
                      suburbs={suburbs()}
                      visitedIds={visitedIds()}
                    />
                  </Show>
                </Loading>
              </Errored>
            </Account>
          </Loading>
        </header>
      </main>
    </MySuburbsContext>
  )
}

interface MapViewProps {
  data: SuburbMapData
  map: MapHandleRef
  search: MapSearch
  suburbs: SuburbProperties[]
  visitedIds: ReadonlySet<string>
  signedIn: boolean
}

function MapView(props: MapViewProps) {
  const { mode, stat, suburbId, setSearch } = props.search

  // Only the current mode's layers load, and the map keeps what it has until
  // they're ready.
  const heatmap = createMemo(
    (): Promise<Heatmap | undefined> | undefined =>
      mode() === "heatmap" ? unlessFailed(getHeatmap(stat())) : undefined,
    { loadingValue: undefined },
  )
  const overlayLayers = createMemo(
    (): Promise<MapLayers | undefined> | MapLayers | undefined => {
      if (mode() === "nrl") {
        return unlessFailed(getNrlLayers())
      }
      if (mode() === "birthplace") {
        return unlessFailed(getBirthplace())
      }
      return heatmap()?.layers
    },
    { loadingValue: undefined },
  )
  const layers = createMemo((): MapLayers => {
    if (mode() !== "visited") {
      return overlayLayers() ?? NO_LAYERS
    }
    return {
      fills: [
        {
          key: "visited",
          ids: props.visitedIds,
          className: "fill-map-visited",
        },
      ],
      outlines: [],
      markers: [],
    }
  })
  const overlay = (): Overlay | undefined => {
    if (mode() === "heatmap") {
      return stat()
    }
    return mode() === "birthplace" ? "birthplace" : undefined
  }

  const byId = createMemo(() => new Map(props.suburbs.map((s) => [s.id, s])))
  // An id the map doesn't draw is no selection at all.
  const selected = () => {
    const id = suburbId()
    return id === undefined ? undefined : byId().get(id)
  }

  function select(id: string | null) {
    const current = selected()
    if (id === (current?.id ?? null)) {
      return
    }
    // Switching suburbs replaces the entry, so Back leaves the map rather
    // than stepping through every suburb looked at.
    setSearch({ suburb: id }, { replace: !!current && !!id })
  }

  function switchMode(next: MapMode) {
    setSearch(
      { mode: next === "visited" ? undefined : next, stat: undefined },
      { replace: true },
    )
  }

  function showHeatmap(next: HeatmapStat) {
    setSearch(
      {
        mode: "heatmap",
        stat: next === DEFAULT_HEATMAP_STAT ? undefined : next,
      },
      { replace: true },
    )
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
  onSettled(() =>
    whenIdle(async () => {
      try {
        await getSuburbFacts()
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
          props.map.current = handle
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
            heatmap={heatmap()}
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
              props.map.current?.zoomTo(id)
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
            props.map.current?.zoomToCouncil(lga)
          }}
          overlay={overlay()}
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
        <a class={buttonVariants()} href="/login">
          Sign in
        </a>
      }
      when={props.signedIn}
    >
      <div class="flex items-center gap-2 text-sm">
        {props.children}
        <Button
          onClick={async () => {
            try {
              await signOut()
            } catch {
              // Still reloads: a live session shows up again, signed in.
            }
            // A full load wipes the cached queries, so the next person on this
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

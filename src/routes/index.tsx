import { type SearchParams, useSearchParams } from "@solidjs/router"
import {
  createMemo,
  createSignal,
  Errored,
  For,
  lazy,
  Loading,
  onSettled,
  Show,
} from "solid-js"

import { HeatmapLegend } from "@/components/heatmap-legend"
import { GitHubLogo } from "@/components/logos"
import { MapKey } from "@/components/map-key"
import { SearchPlaceholder } from "@/components/map/search-placeholder"
import {
  type SuburbHover,
  SuburbMap,
  type SuburbMapHandle,
} from "@/components/map/suburb-map"
import { SuburbTooltip } from "@/components/regions/suburb-tooltip"
import { Button, buttonVariants } from "@/components/ui/button"
import { useCustomMap } from "@/hooks/use-custom-map"
import { useShortcut } from "@/hooks/use-shortcut"
import { getSession, signOut } from "@/lib/auth"
import type { Heatmap } from "@/lib/heatmap"
import { whenIdle } from "@/lib/idle"
import { preload } from "@/lib/load"
import { regionBySuburb } from "@/lib/regions"
import {
  DEFAULT_HEATMAP_STAT,
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

const RegionsPanel = lazy(async () => {
  const { RegionsPanel: component } =
    await import("@/components/regions/regions-panel")

  return { default: component }
})

const MAP_MODES = ["visited", "heatmap", "birthplace", "nrl", "custom"] as const

type MapMode = (typeof MAP_MODES)[number]

const MODE_LABELS: Record<MapMode, string> = {
  visited: "Visited",
  nrl: "NRL",
  heatmap: "Heatmap",
  birthplace: "Birthplace",
  custom: "Custom map",
}

// Visited is the default mode and only the heatmap has a stat, so neither the
// default mode nor the default stat goes in the URL.
interface MapSearch extends SearchParams {
  mode?: MapMode
  stat?: HeatmapStat
  suburb?: string
  // The custom map region being edited.
  region?: string
}

const NO_LAYERS: MapLayers = { fills: [], outlines: [], markers: [] }
const NO_IDS: ReadonlySet<string> = new Set()

// Filled in by the map once it's drawn, for the header and panel to zoom it.
interface MapHandleRef {
  current?: SuburbMapHandle
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
  const [search] = useSearchParams<MapSearch>()
  const session = createMemo(async () => await getSession())
  const signedIn = () => !!session()
  const mySuburbs = createMySuburbs(signedIn)
  const [rows] = mySuburbs
  const topo = createMemo(async () => await getSuburbsTopo())
  const map: MapHandleRef = {}
  const suburbs = createMemo(() => topo().suburbs.map((s) => s.properties))

  // Waits for the rows, for the counter. A notes save changes the rows but not
  // what's visited.
  const visitedIds = createMemo(
    (): ReadonlySet<string> =>
      new Set(rows.filter((row) => row.visited).map((row) => row.suburbId)),
    { equals: (a, b) => a.size === b.size && [...a].every((id) => b.has(id)) },
  )

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
            <Show
              fallback={
                <a class={buttonVariants()} href="/login">
                  Sign in
                </a>
              }
              when={signedIn()}
            >
              <div class="flex items-center gap-2 text-sm">
                <Errored fallback={null}>
                  <Loading>
                    <Show when={search.mode === undefined}>
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
                <Button
                  onClick={async () => {
                    try {
                      await signOut()
                    } catch {
                      // Still reloads: a live session shows up again, signed in.
                    }

                    // A full load wipes the cached queries, so the next person
                    // on this browser can't see these visits.
                    window.location.assign("/")
                  }}
                  variant="outline"
                >
                  Sign out
                </Button>
              </div>
            </Show>
          </Loading>
        </header>
      </main>
    </MySuburbsContext>
  )
}

interface MapViewProps {
  data: SuburbMapData
  map: MapHandleRef
  suburbs: SuburbProperties[]
  visitedIds: ReadonlySet<string>
  signedIn: boolean
}

function MapView(props: MapViewProps) {
  const [search, setSearch] = useSearchParams<MapSearch>()
  const mode = (): MapMode => search.mode ?? "visited"
  const stat = (): HeatmapStat => search.stat ?? DEFAULT_HEATMAP_STAT
  const customMode = () => mode() === "custom"

  const knownIds = createMemo(() => new Set(props.suburbs.map((s) => s.id)))
  const custom = useCustomMap(knownIds, () => search.region)

  // The region maths loads with the mode, then draws every change in step.
  const regionTools = createMemo(
    async () =>
      customMode() ? await import("@/lib/region-layers") : undefined,
    { loadingValue: undefined },
  )

  const customLayers = createMemo((): MapLayers => {
    const tools = regionTools()

    if (!tools) {
      return NO_LAYERS
    }

    const draft = { ids: custom.selection(), color: custom.draftColor() }

    return tools.regionLayers(custom.map(), props.data, draft)
  })

  const [hover, setHover] = createSignal<SuburbHover | null>(null)
  const regionOf = createMemo(() => regionBySuburb(custom.map()))

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
    if (customMode()) {
      return customLayers()
    }

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
  const selected = () =>
    customMode() ? undefined : byId().get(search.suburb ?? "")

  // In the custom map a click adds or removes a suburb instead.
  function select(id: string | null) {
    if (customMode()) {
      if (id) {
        custom.toggle(id)
      }

      return
    }

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
      {
        mode: next === "visited" ? undefined : next,
        stat: undefined,
        region: undefined,
        suburb: next === "custom" ? undefined : search.suburb,
      },
      { replace: true },
    )
  }

  function activateRegion(id: string | null) {
    custom.clearSelection()
    setSearch({ region: id ?? undefined }, { replace: true })
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

  useShortcut("Escape", () => {
    if (!customMode()) {
      select(null)
    } else if (custom.active()) {
      activateRegion(null)
    } else {
      custom.clearSelection()
    }
  })

  // The map has rendered by now, so fetch the facts and the other modes' code
  // when the browser is idle, ready before they're picked. A deep link's panel
  // fetches the facts right away.
  onSettled(() =>
    whenIdle(async () => {
      await preload(
        getSuburbFacts,
        NrlLegend.preload,
        BirthplaceLegend.preload,
        async () => await import("@/lib/nrl"),
        async () => await import("@/lib/birthplace"),
        RegionsPanel.preload,
        async () => await import("@/lib/region-layers"),
      )
    }),
  )

  return (
    <>
      <SuburbMap
        data={props.data}
        layers={layers()}
        onHover={customMode() ? setHover : undefined}
        onSelect={select}
        ref={(handle) => {
          props.map.current = handle
        }}
        selectedId={selected()?.id ?? null}
      />
      <div class="absolute inset-x-4 bottom-4 flex flex-col items-start gap-2 md:right-auto">
        <Show when={mode() !== "visited"}>
          <MapKey label={customMode() ? "Regions" : "Key"}>
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
            <Loading>
              <Show when={customMode()}>
                <RegionsPanel
                  custom={custom}
                  data={props.data}
                  onActivate={activateRegion}
                  suburbs={props.suburbs}
                />
              </Show>
            </Loading>
          </MapKey>
        </Show>
        <fieldset class="flex gap-1 rounded-lg border bg-background p-0.5 shadow-sm">
          <legend class="sr-only">Map mode</legend>
          <For each={MAP_MODES}>
            {(m) => (
              <Button
                aria-pressed={m === mode() ? "true" : "false"}
                onClick={() => {
                  switchMode(m)
                }}
                size="sm"
                variant={m === mode() ? "secondary" : "ghost"}
              >
                {/* Phones are too narrow for every mode's full label. */}
                <Show fallback={MODE_LABELS[m]} when={m === "custom"}>
                  Custom<span class="hidden sm:inline"> map</span>
                </Show>
              </Button>
            )}
          </For>
        </fieldset>
      </div>
      <div class="absolute inset-x-4 top-14 md:right-auto md:w-72">
        <Loading fallback={<SearchPlaceholder />}>
          <SuburbSearch
            onPick={(id) => {
              // Searching adds, since a toggle could take the suburb away.
              if (customMode()) {
                custom.addMany([id])
              } else {
                select(id)
              }

              props.map.current?.zoomTo(id)
            }}
            suburbs={props.suburbs}
            visitedIds={props.visitedIds}
          />
        </Loading>
      </div>
      <Show when={customMode()}>
        <SuburbTooltip
          hover={hover()}
          name={(id) => byId().get(id)?.name}
          region={(id) => regionOf().get(id)?.name}
        />
      </Show>
      <Loading>
        <SuburbPanel
          onClose={() => {
            select(null)
          }}
          // Picking what's already on the map goes back to the visited mode.
          onToggleOverlay={(next) => {
            if (next === overlay()) {
              switchMode("visited")
            } else if (next === "birthplace") {
              switchMode("birthplace")
            } else {
              showHeatmap(next)
            }
          }}
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

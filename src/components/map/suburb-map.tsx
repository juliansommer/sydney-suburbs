import type { JSX } from "@solidjs/web"
import "d3-transition"
import { type Selection, select } from "d3-selection"
import {
  type D3ZoomEvent,
  zoom,
  type ZoomBehavior,
  zoomIdentity,
  type ZoomTransform,
} from "d3-zoom"
import {
  type Accessor,
  createEffect,
  createMemo,
  createProjection,
  createSignal,
  createUniqueId,
  For,
  Show,
  untrack,
} from "solid-js"

import { useElementSize } from "@/hooks/use-element-size"
import { CHAR_WIDTH, labelFits, placeLabels, type Rect } from "@/lib/labels"
import { type Bounds, fitBounds } from "@/lib/zoom"
import type { MapLayers } from "@/types/map-layers"
import type { LanduseKind, SuburbMapData } from "@/types/suburb"

import {
  projectBase,
  type ProjectedBase,
  type ProjectedFill,
  type ProjectedLabel,
  projectLayers,
  type ProjectedMarker,
  type ProjectedSuburb,
} from "./project"
import { SuburbLabels } from "./suburb-labels"

const MAX_ZOOM = 40

// Pointer travel, in pixels, past which a press is a pan rather than a click.
const CLICK_DISTANCE = 4
const ZOOM_TO_MS = 600

// How far a gesture can shrink the drawn map before it's redrawn.
const MAX_ZOOM_OUT_DRIFT = 2

// How far a gesture can enlarge it, which thickens the borders, before then.
const MAX_ZOOM_IN_DRIFT = 1.25

// Markers keep this size on screen at every zoom, smaller on narrow screens.
const MARKER_SIZE = 44
const SMALL_MARKER_SIZE = 32
const SMALL_SCREEN_WIDTH = 768

// Area names, like custom regions, read over the suburb names.
const AREA_LABEL_SIZE = 16
const AREA_HALO_WIDTH = 4

// Picked colours are softened toward the land, like the club colours.
const TINTED_FILL = "fill-region"

// Fill images are flags, drawn at 4:3.
const IMAGE_ASPECT = [4, 3] as const

// Firefox keeps a transformed group as a scaled bitmap for a few seconds
// after it stops changing, which looks blurry, so it gets remounted there.
const REMOUNT_AFTER_GESTURE = navigator.userAgent.includes("Firefox")

const LANDUSE_FILL: Record<LanduseKind, string> = {
  parkland: "fill-map-surrounds",
  water: "fill-map-water",
}

interface SuburbMapProps {
  data: SuburbMapData
  selectedId: string | null
  layers: MapLayers
  // Called with null when a click lands off the suburbs (water, surrounds).
  onSelect: (id: string | null) => void
  // The suburb under a mouse pointer, at its position in the viewport, or
  // null once it leaves the suburbs or starts dragging.
  onHover?: (hover: SuburbHover | null) => void
  ref?: (handle: SuburbMapHandle) => void
}

export interface SuburbHover {
  id: string
  x: number
  y: number
}

export interface SuburbMapHandle {
  // Both animate to fit the area on screen, and do nothing before the first
  // draw. A council stays outlined until a suburb is picked.
  zoomTo: (id: string) => void
  zoomToCouncil: (lga: string) => void
}

interface Zoomer {
  selection: Selection<HTMLDivElement, unknown, null, undefined>
  behaviour: ZoomBehavior<HTMLDivElement, unknown>
}

// Fills its container. The map is drawn once the container has a size, and
// then zooms to the selected suburb, if any.
export function SuburbMap(props: SuburbMapProps) {
  const [ref, size] = useElementSize()
  const width = () => size()?.width ?? 0
  const height = () => size()?.height ?? 0

  const projected = createMemo(() =>
    width() > 0 && height() > 0
      ? projectBase(props.data, width(), height())
      : null,
  )

  return (
    <div class="size-full" ref={ref}>
      <Show when={projected()}>
        {(base) => (
          <ZoomableMap
            height={height()}
            layers={props.layers}
            onHover={props.onHover}
            onSelect={props.onSelect}
            projected={base()}
            ref={props.ref}
            selectedId={props.selectedId}
            width={width()}
          />
        )}
      </Show>
    </div>
  )
}

interface ZoomableMapProps extends Omit<SuburbMapProps, "data"> {
  projected: ProjectedBase
  width: number
  height: number
}

function ZoomableMap(props: ZoomableMapProps) {
  let container: HTMLDivElement | undefined
  let zoomed: SVGSVGElement | undefined

  const { zoomer, transform, scale, gesture } = useZoom(
    () => container,
    () => props.width,
    () => props.height,
    () => {
      // Runs once the map is first drawn.
      if (props.selectedId) {
        zoomTo(props.selectedId, false)
      }
    },
  )

  // The paths are drawn at the scale the last gesture ended on, and the
  // gesture itself moves and scales that drawing rather than repainting it.
  // Set directly, as a custom property would restyle every path each frame.
  createEffect(
    () => ({ t: transform(), drawnScale: scale() }),
    ({ t, drawnScale }) => {
      if (zoomed) {
        zoomed.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.k / drawnScale})`
      }
    },
  )

  const layers = createMemo(() => projectLayers(props.layers, props.projected))

  const [outlinedLga, setOutlinedLga] = createSignal<string | null>(null)

  // Picking the selected suburb again closes it, like the close button.
  function pick(id: string | null) {
    const next = id === props.selectedId ? null : id

    if (next) {
      setOutlinedLga(null)
    }

    props.onSelect(next)
  }

  function zoomToBounds(bounds: Bounds, animate: boolean, minZoom?: number) {
    const current = zoomer()

    if (!current) {
      return
    }

    const { selection, behaviour } = current
    const { x, y, k } = fitBounds(bounds, props.width, props.height, minZoom)
    // The pan limits are the viewport itself.
    const extent = behaviour.translateExtent()

    // Unlike gestures, a programmatic transform skips the pan limits.
    const target = behaviour.constrain()(
      zoomIdentity.translate(x, y).scale(k),
      extent,
      extent,
    )

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches

    if (animate && !reduceMotion) {
      selection
        .transition()
        .duration(ZOOM_TO_MS)
        .call((t) => {
          behaviour.transform(t, target)
        })
    } else {
      behaviour.transform(selection, target)
    }
  }

  function zoomTo(id: string, animate: boolean) {
    const suburb = props.projected.suburbs.find((s) => s.id === id)

    if (suburb) {
      zoomToBounds(suburb.bounds, animate)
    }
  }

  props.ref?.({
    zoomTo: (id) => {
      setOutlinedLga(null)
      zoomTo(id, true)
    },
    zoomToCouncil: (lga) => {
      const council = props.projected.councils.find((c) => c.lga === lga)

      if (!council) {
        return
      }

      // A whole council can be too big for the 2x minimum meant for suburbs.
      zoomToBounds(council.bounds, true, 1)
      setOutlinedLga(lga)
    },
  })

  return (
    // Keyboard users select through the suburb paths and clear with Escape;
    // this handler only adds "click off the suburbs to deselect".
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      class="relative size-full touch-none overflow-hidden bg-map-water select-none"
      onClick={(event) => {
        if (event.target instanceof Element) {
          const suburb = event.target.closest<SVGElement>("[data-suburb-id]")
          pick(suburb?.dataset.suburbId ?? null)
        }
      }}
      onPointerLeave={() => props.onHover?.(null)}
      onPointerMove={(event) => {
        props.onHover?.(hoverAt(event))
      }}
      ref={(element) => {
        container = element
      }}
    >
      <svg
        aria-label="Map of Sydney suburbs"
        class="absolute top-0 left-0 origin-top-left overflow-visible will-change-transform"
        height={props.height}
        ref={(element) => {
          zoomed = element
        }}
        width={props.width}
      >
        <Show keyed when={gesture()}>
          {(_gesture) => (
            <g transform={`scale(${scale()})`}>
              <path class="fill-map-surrounds" d={props.projected.surrounds} />
              {/* Plain land under the parks and water. */}
              <path class="fill-map-land" d={props.projected.land} />
              <For each={props.projected.landuse} keyed={(l) => l.kind}>
                {(l) => <path class={LANDUSE_FILL[l().kind]} d={l().d} />}
              </For>
              {/* Over the parks and water, so a filled suburb is filled edge to edge. */}
              {/* Keyed by layer, so a re-projection updates paths in place. */}
              <For
                each={layers().fills.filter((f) => f.d)}
                keyed={(f) => f.key}
              >
                {(f) => <FillPath fill={f()} />}
              </For>
              <SuburbPaths
                onSelect={pick}
                selectedId={props.selectedId}
                suburbs={props.projected.suburbs}
              />
              <For each={layers().outlines} keyed={(o) => o.key}>
                {(o) => <Outline d={o().d} strokeWidth={1.5} />}
              </For>
              <Outline
                d={
                  props.projected.councils.find((c) => c.lga === outlinedLga())
                    ?.d
                }
                strokeWidth={3}
              />
              {/* SVG has no z-index, so the selected suburb is drawn again last to
                  keep its outline above the neighbouring borders. */}
              <Outline
                d={
                  props.projected.suburbs.find((s) => s.id === props.selectedId)
                    ?.d
                }
                strokeWidth={2.5}
              />
            </g>
          )}
        </Show>
      </svg>
      <svg
        class="pointer-events-none absolute top-0 left-0"
        height={props.height}
        width={props.width}
      >
        <ScreenLayer
          height={props.height}
          labels={layers().labels}
          markers={layers().markers}
          suburbs={props.projected.suburbs}
          transform={transform()}
          width={props.width}
        />
      </svg>
    </div>
  )
}

// d3-zoom on the map's container, with the current transform in a signal.
// The behaviour is rebuilt whenever the viewport size changes.
function useZoom(
  container: Accessor<HTMLDivElement | undefined>,
  width: Accessor<number>,
  height: Accessor<number>,
  onFirstDraw: () => void,
) {
  const [transform, setTransform] = createSignal<ZoomTransform>(zoomIdentity)
  // The transform's scale, but only updated when a gesture ends.
  const [scale, setScale] = createSignal(zoomIdentity.k)
  // Bumped when a gesture ends in Firefox, to redraw the map sharp. Starts at
  // 1 so the keyed group, which needs a truthy key, renders from the start.
  const [gesture, setGesture] = createSignal(1)
  let zoomer: Zoomer | null = null
  let drawn = false

  // The container is read in the apply phase, by which time it has rendered.
  createEffect(
    () => ({ w: width(), h: height() }),
    ({ w, h }) => {
      const element = container()

      if (!element) {
        return undefined
      }

      const extent: [[number, number], [number, number]] = [
        [0, 0],
        [w, h],
      ]

      let startTransform = zoomIdentity

      const behaviour = zoom<HTMLDivElement, unknown>()
        .extent(extent)
        .translateExtent(extent)
        .scaleExtent([1, MAX_ZOOM])
        .clickDistance(CLICK_DISTANCE)
        .on("start", (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
          startTransform = event.transform
        })
        .on("zoom", (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
          setTransform(event.transform)

          // Zoomed out, a drawing at the old scale is too big to rasterise
          // quickly, and zoomed in its borders thicken, so either redraws.
          const drawnScale = untrack(scale)
          const tooSmall = event.transform.k < drawnScale / MAX_ZOOM_OUT_DRIFT
          const tooBig = event.transform.k > drawnScale * MAX_ZOOM_IN_DRIFT

          if (tooSmall || tooBig) {
            setScale(event.transform.k)
          }
        })
        .on("end", (event: D3ZoomEvent<HTMLDivElement, unknown>) => {
          setScale(event.transform.k)

          // A plain click starts and ends a gesture too, and remounting then
          // would swap the paths out from under the click.
          if (REMOUNT_AFTER_GESTURE && event.transform !== startTransform) {
            setGesture((n) => n + 1)
          }
        })

      const selection = select(element)
      // A click toggles a suburb, so a quick select-then-close would otherwise
      // read as a double-click and zoom in.
      selection.call(behaviour).on("dblclick.zoom", null)
      zoomer = { selection, behaviour }

      if (!drawn) {
        drawn = true
        untrack(onFirstDraw)
      }

      return () => {
        zoomer = null
        selection.interrupt().on(".zoom", null)
      }
    },
  )

  return { zoomer: () => zoomer, transform, scale, gesture }
}

// Touch has no hover, and a drag is a pan rather than a point.
function hoverAt(event: PointerEvent): SuburbHover | null {
  const dragging = event.pointerType !== "mouse" || event.buttons !== 0
  const target = event.target instanceof Element ? event.target : null
  const id = target?.closest<SVGElement>("[data-suburb-id]")?.dataset.suburbId

  return dragging || !id ? null : { id, x: event.clientX, y: event.clientY }
}

interface ScreenLayerProps {
  transform: ZoomTransform
  suburbs: ProjectedSuburb[]
  markers: ProjectedMarker[]
  labels: ProjectedLabel[]
  width: number
  height: number
}

// Labels and markers follow the zoom but are drawn in screen space.
function ScreenLayer(props: ScreenLayerProps) {
  const markerSize = () =>
    props.width < SMALL_SCREEN_WIDTH ? SMALL_MARKER_SIZE : MARKER_SIZE

  const placedMarkers = createMemo(() =>
    onScreen(props.markers, props.transform, props.width, props.height),
  )

  const placedAreas = createMemo(() => {
    const { transform, width, height } = props

    const candidates = props.labels.flatMap((l) => {
      if (!labelFits(l, transform.k, l.text, AREA_LABEL_SIZE)) {
        return []
      }

      const [x, y] = transform.apply([l.x, l.y])
      const offScreen = x < 0 || x > width || y < 0 || y > height

      return offScreen ? [] : [{ ...l, name: l.text, x, y }]
    })

    return placeLabels(candidates, AREA_LABEL_SIZE)
  })

  // Suburb names give way to the markers and the area names.
  const obstacles = () => [
    ...placedMarkers().map((m) => markerRect(m, markerSize())),
    ...placedAreas().map((l) => labelRect(l, AREA_LABEL_SIZE)),
  ]

  return (
    <>
      <SuburbLabels
        dimmed={props.labels.length > 0}
        height={props.height}
        obstacles={obstacles()}
        suburbs={props.suburbs}
        transform={props.transform}
        width={props.width}
      />
      <Markers markers={placedMarkers()} size={markerSize()} />
      <AreaLabels labels={placedAreas()} />
    </>
  )
}

interface AreaLabelsProps {
  labels: ProjectedLabel[]
}

// Larger and bolder than the suburb names, with the same halo.
function AreaLabels(props: AreaLabelsProps) {
  return (
    <g
      class="pointer-events-none fill-map-label stroke-map-halo [paint-order:stroke]"
      dominant-baseline="central"
      font-size={AREA_LABEL_SIZE}
      font-weight={600}
      stroke-linejoin="round"
      stroke-width={AREA_HALO_WIDTH}
      text-anchor="middle"
    >
      <For each={props.labels} keyed={(l) => l.key}>
        {(l) => (
          <text x={l().x} y={l().y}>
            {l().text}
          </text>
        )}
      </For>
    </g>
  )
}

interface SuburbPathsProps {
  suburbs: ProjectedSuburb[]
  selectedId: string | null
  onSelect: (id: string) => void
}

// Transparent on top of the land use, so borders and hover show over parks.
// Hover is an outline rather than a fill so it still reads on visited green.
// Clicks reach the SVG's handler through `data-suburb-id`.
function SuburbPaths(props: SuburbPathsProps) {
  // Only the old and new selection's paths update, not all of them.
  let previous: string | null = null

  const pressed = createProjection<Record<string, boolean>>((draft) => {
    if (previous !== null) {
      draft[previous] = false
    }

    previous = props.selectedId

    if (previous !== null) {
      draft[previous] = true
    }
  }, {})

  return (
    <g
      class="fill-transparent stroke-map-border"
      stroke-linejoin="round"
      stroke-width={0.75}
    >
      {/* Keyed by id, so a re-projection updates `d` rather than remounting. */}
      <For each={props.suburbs} keyed={(s) => s.id}>
        {(s) => (
          <path
            aria-label={s().name}
            aria-pressed={pressed[s().id] ? "true" : "false"}
            class="cursor-pointer outline-none hover:stroke-map-label hover:stroke-2 focus-visible:stroke-ring focus-visible:stroke-2"
            d={s().d}
            data-suburb-id={s().id}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                props.onSelect(s().id)
              }
            }}
            // A <button> can't live inside an SVG, so the path takes its role.
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
            role="button"
            tabindex={0}
            vector-effect="non-scaling-stroke"
          />
        )}
      </For>
    </g>
  )
}

interface FillPathProps {
  fill: ProjectedFill
}

// An image fill is a pattern sized to each suburb's bounding box, so every
// suburb shows the whole image, cropped to its shape rather than stretched.
function FillPath(props: FillPathProps) {
  const patternId = createUniqueId()

  return (
    <Show
      fallback={
        <path
          class={props.fill.color ? TINTED_FILL : props.fill.className}
          d={props.fill.d}
          data-layer={props.fill.key}
          style={
            props.fill.color ? { "--region": props.fill.color } : undefined
          }
        />
      }
      when={props.fill.image}
    >
      {(image) => (
        <g data-layer={props.fill.key} fill={`url(#${patternId})`}>
          <defs>
            <pattern
              height={1}
              id={patternId}
              patternUnits="objectBoundingBox"
              preserveAspectRatio="xMidYMid slice"
              viewBox={`0 0 ${IMAGE_ASPECT[0]} ${IMAGE_ASPECT[1]}`}
              width={1}
            >
              <image
                height={IMAGE_ASPECT[1]}
                href={image()}
                preserveAspectRatio="none"
                width={IMAGE_ASPECT[0]}
              />
            </pattern>
          </defs>
          <For each={props.fill.parts} keyed={(p) => p.id}>
            {(p) => <path d={p().d} />}
          </For>
        </g>
      )}
    </Show>
  )
}

interface OutlineProps {
  d: string | undefined
  strokeWidth: number
}

function Outline(props: OutlineProps): JSX.Element {
  return (
    <Show when={props.d}>
      <path
        class="pointer-events-none stroke-foreground"
        d={props.d}
        fill="none"
        stroke-linejoin="round"
        stroke-width={props.strokeWidth}
        vector-effect="non-scaling-stroke"
      />
    </Show>
  )
}

// Moves markers into screen space, dropping any that fall off screen.
function onScreen(
  markers: ProjectedMarker[],
  transform: ZoomTransform,
  width: number,
  height: number,
): ProjectedMarker[] {
  return markers.flatMap((m) => {
    const [x, y] = transform.apply([m.x, m.y])
    const offScreen = x < 0 || x > width || y < 0 || y > height

    return offScreen ? [] : [{ ...m, x, y }]
  })
}

function markerRect({ x, y }: ProjectedMarker, size: number): Rect {
  const half = size / 2

  return { x0: x - half, y0: y - half, x1: x + half, y1: y + half }
}

function labelRect({ x, y, text }: ProjectedLabel, fontSize: number): Rect {
  const halfWidth = (text.length * CHAR_WIDTH * fontSize) / 2
  const halfHeight = fontSize / 2

  return {
    x0: x - halfWidth,
    y0: y - halfHeight,
    x1: x + halfWidth,
    y1: y + halfHeight,
  }
}

interface MarkersProps {
  markers: ProjectedMarker[]
  size: number
}

// In screen space like the labels, so they stay one size at every zoom.
// Clicks pass through to the suburb underneath.
function Markers(props: MarkersProps) {
  return (
    <g class="pointer-events-none">
      <For each={props.markers} keyed={(m) => m.key}>
        {(m) => (
          <image
            aria-label={m().label}
            height={props.size}
            href={m().src}
            width={props.size}
            x={m().x - props.size / 2}
            y={m().y - props.size / 2}
          />
        )}
      </For>
    </g>
  )
}

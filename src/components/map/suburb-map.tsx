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
  createSignal,
  createUniqueId,
  For,
  Show,
  untrack,
} from "solid-js"

import { useElementSize } from "@/hooks/use-element-size"
import type { Rect } from "@/lib/labels"
import { type Bounds, fitBounds } from "@/lib/zoom"
import type { MapLayers } from "@/types/map-layers"
import type { LanduseKind, SuburbMapData } from "@/types/suburb"

import {
  projectBase,
  type ProjectedBase,
  type ProjectedFill,
  projectLayers,
  type ProjectedMarker,
  type ProjectedSuburb,
} from "./project"
import { SuburbLabels } from "./suburb-labels"

const MAX_ZOOM = 40
// Pointer travel, in pixels, past which a press is a pan rather than a click.
const CLICK_DISTANCE = 4
const ZOOM_TO_MS = 600
// Markers keep this size on screen at every zoom, smaller on narrow screens.
const MARKER_SIZE = 44
const SMALL_MARKER_SIZE = 32
const SMALL_SCREEN_WIDTH = 768
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
  ref?: (handle: SuburbMapHandle) => void
}

export interface SuburbMapHandle {
  // Both animate to fit the area on screen, and do nothing before the first
  // draw. A council stays outlined until a suburb is picked.
  zoomTo: (id: string) => void
  zoomToCouncil: (lga: string) => void
}

interface Zoomer {
  selection: Selection<SVGSVGElement, unknown, null, undefined>
  behaviour: ZoomBehavior<SVGSVGElement, unknown>
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
  let svg: SVGSVGElement | undefined
  const { zoomer, transform, gesture } = useZoom(
    () => svg,
    () => props.width,
    () => props.height,
    () => {
      // Runs once the map is first drawn.
      if (props.selectedId) {
        zoomTo(props.selectedId, false)
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
    <svg
      aria-label="Map of Sydney suburbs"
      class="block touch-none select-none"
      height={props.height}
      onClick={(event) => {
        if (event.target instanceof Element) {
          const suburb = event.target.closest<SVGElement>("[data-suburb-id]")
          pick(suburb?.dataset.suburbId ?? null)
        }
      }}
      ref={(element) => {
        svg = element
      }}
      width={props.width}
    >
      <rect class="fill-map-water" height={props.height} width={props.width} />
      <Show keyed when={gesture()}>
        {(_gesture) => (
          <g transform={transform().toString()}>
            <path class="fill-map-surrounds" d={props.projected.surrounds} />
            {/* Plain land under the parks and water. */}
            <path class="fill-map-land" d={props.projected.land} />
            <For each={props.projected.landuse}>
              {(l) => <path class={LANDUSE_FILL[l.kind]} d={l.d} />}
            </For>
            {/* Over the parks and water, so a filled suburb is filled edge to edge. */}
            <For each={layers().fills.filter((f) => f.d)}>
              {(f) => <FillPath fill={f} />}
            </For>
            <SuburbPaths
              onSelect={pick}
              selectedId={props.selectedId}
              suburbs={props.projected.suburbs}
            />
            <For each={layers().outlines}>
              {(o) => <Outline d={o.d} strokeWidth={1.5} />}
            </For>
            <Outline
              d={
                props.projected.councils.find((c) => c.lga === outlinedLga())?.d
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
      <ScreenLayer
        height={props.height}
        markers={layers().markers}
        suburbs={props.projected.suburbs}
        transform={transform()}
        width={props.width}
      />
    </svg>
  )
}

// d3-zoom on the map's SVG, with the current transform in a signal. The
// behaviour is rebuilt whenever the viewport size changes.
function useZoom(
  svg: Accessor<SVGSVGElement | undefined>,
  width: Accessor<number>,
  height: Accessor<number>,
  onFirstDraw: () => void,
) {
  const [transform, setTransform] = createSignal<ZoomTransform>(zoomIdentity)
  // Bumped when a gesture ends in Firefox, to redraw the map sharp. Starts at
  // 1 so the keyed group, which needs a truthy key, renders from the start.
  const [gesture, setGesture] = createSignal(1)
  let zoomer: Zoomer | null = null
  let drawn = false

  // The SVG is read in the apply phase, by which time it has been rendered.
  createEffect(
    () => ({ w: width(), h: height() }),
    ({ w, h }) => {
      const element = svg()
      if (!element) {
        return undefined
      }
      const extent: [[number, number], [number, number]] = [
        [0, 0],
        [w, h],
      ]
      let startTransform = zoomIdentity
      const behaviour = zoom<SVGSVGElement, unknown>()
        .extent(extent)
        .translateExtent(extent)
        .scaleExtent([1, MAX_ZOOM])
        .clickDistance(CLICK_DISTANCE)
        .on("start", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
          startTransform = event.transform
        })
        .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
          setTransform(event.transform)
        })
        .on("end", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
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

  return { zoomer: () => zoomer, transform, gesture }
}

interface ScreenLayerProps {
  transform: ZoomTransform
  suburbs: ProjectedSuburb[]
  markers: ProjectedMarker[]
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
  return (
    <>
      <SuburbLabels
        height={props.height}
        obstacles={placedMarkers().map((m) => markerRect(m, markerSize()))}
        suburbs={props.suburbs}
        transform={props.transform}
        width={props.width}
      />
      <Markers markers={placedMarkers()} size={markerSize()} />
    </>
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
  return (
    <g
      class="fill-transparent stroke-map-border"
      stroke-linejoin="round"
      stroke-width={0.75}
    >
      <For each={props.suburbs}>
        {(s) => (
          <path
            aria-label={s.name}
            aria-pressed={s.id === props.selectedId ? "true" : "false"}
            class="cursor-pointer outline-none hover:stroke-map-label hover:stroke-2 focus-visible:stroke-ring focus-visible:stroke-2"
            d={s.d}
            data-suburb-id={s.id}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                props.onSelect(s.id)
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
          class={props.fill.className}
          d={props.fill.d}
          data-layer={props.fill.key}
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
          <For each={props.fill.parts}>{(p) => <path d={p.d} />}</For>
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

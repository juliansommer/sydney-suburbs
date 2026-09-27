import { type Selection, select } from "d3-selection"
import "d3-transition"
import {
  type D3ZoomEvent,
  zoom,
  type ZoomBehavior,
  zoomIdentity,
} from "d3-zoom"
import {
  type Ref,
  useCallback,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"

import { useElementSize } from "@/hooks/use-element-size"
import { fitBounds, mergeBounds } from "@/lib/zoom"
import type { LanduseKind, SuburbMapData } from "@/types/suburb"

import {
  projectMap,
  type ProjectedLanduse,
  type ProjectedSuburb,
} from "./project"
import { SuburbLabels } from "./suburb-labels"

const MAX_ZOOM = 40
// Pointer travel, in pixels, past which a press is a pan rather than a click.
const CLICK_DISTANCE = 4
const ZOOM_TO_MS = 600

const LANDUSE_FILL: Record<LanduseKind, string> = {
  parkland: "fill-map-surrounds",
  water: "fill-map-water",
}

interface SuburbMapProps {
  data: SuburbMapData
  selectedId: string | null
  visitedIds: ReadonlySet<string>
  // Called with null when a click lands off the suburbs (water, surrounds).
  onSelect: (id: string | null) => void
  ref?: Ref<SuburbMapHandle>
}

export interface SuburbMapHandle {
  // Animates to fit the suburbs on screen. Does nothing before the first draw.
  zoomTo: (ids: readonly string[]) => void
}

interface Zoomer {
  selection: Selection<SVGSVGElement, unknown, null, undefined>
  behaviour: ZoomBehavior<SVGSVGElement, unknown>
}

function viewExtent(width: number, height: number) {
  const extent: [[number, number], [number, number]] = [
    [0, 0],
    [width, height],
  ]
  return extent
}

// Fills its container. The map is drawn once the container has a size, and
// then zooms to the selected suburb, if any.
export function SuburbMap(props: SuburbMapProps) {
  const [ref, size] = useElementSize()
  return (
    <div className="size-full" ref={ref}>
      {size && size.width > 0 && size.height > 0 ? (
        <ZoomableMap {...props} height={size.height} width={size.width} />
      ) : null}
    </div>
  )
}

interface ZoomableMapProps extends SuburbMapProps {
  width: number
  height: number
}

function ZoomableMap({
  data,
  selectedId,
  visitedIds,
  onSelect,
  ref,
  width,
  height,
}: ZoomableMapProps) {
  const [transform, setTransform] = useState(zoomIdentity)
  // Firefox keeps a transformed group as a scaled bitmap for a few seconds
  // after it stops changing, which looks blurry. Remounting it once a gesture
  // ends makes it redraw sharp straight away.
  const [gesture, setGesture] = useState(0)
  const projected = useMemo(
    () => projectMap(data, width, height),
    [data, width, height],
  )
  const zoomer = useRef<Zoomer | null>(null)

  function zoomTo(ids: readonly string[], animate: boolean) {
    const wanted = new Set(ids)
    const bounds = projected.suburbs
      .filter((s) => wanted.has(s.id))
      .map((s) => s.bounds)
    if (bounds.length === 0 || !zoomer.current) {
      return
    }
    const { selection, behaviour } = zoomer.current
    // A whole council can be too big for the 2x minimum meant for suburbs.
    const { x, y, k } = fitBounds(
      mergeBounds(bounds),
      width,
      height,
      bounds.length > 1 ? 1 : undefined,
    )
    const extent = viewExtent(width, height)
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

  useImperativeHandle(ref, () => ({
    zoomTo: (ids) => {
      zoomTo(ids, true)
    },
  }))

  const onDrawn = useEffectEvent(() => {
    if (selectedId) {
      zoomTo([selectedId], false)
    }
  })
  useEffect(() => {
    onDrawn()
  }, [])

  const svgRef = useCallback(
    (svg: SVGSVGElement | null) => {
      if (!svg) {
        return undefined
      }
      const extent = viewExtent(width, height)
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
          if (event.transform !== startTransform) {
            setGesture((n) => n + 1)
          }
        })
      const selection = select(svg)
      selection.call(behaviour)
      zoomer.current = { selection, behaviour }
      return () => {
        zoomer.current = null
        selection.interrupt().on(".zoom", null)
      }
    },
    [width, height],
  )

  return (
    // Keyboard users select through the suburb paths and clear with Escape;
    // this handler only adds "click off the suburbs to deselect".
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <svg
      aria-label="Map of Sydney suburbs"
      className="block touch-none select-none"
      height={height}
      onClick={(event) => {
        if (event.target instanceof Element) {
          const suburb = event.target.closest<SVGElement>("[data-suburb-id]")
          onSelect(suburb?.dataset.suburbId ?? null)
        }
      }}
      ref={svgRef}
      width={width}
    >
      <rect className="fill-map-water" height={height} width={width} />
      <g key={gesture} transform={transform.toString()}>
        <path className="fill-map-surrounds" d={projected.surrounds} />
        <LandPaths suburbs={projected.suburbs} />
        <LandusePaths landuse={projected.landuse} />
        <VisitedPaths suburbs={projected.suburbs} visitedIds={visitedIds} />
        <SuburbPaths
          onSelect={onSelect}
          selectedId={selectedId}
          suburbs={projected.suburbs}
        />
        <SelectedOutline selectedId={selectedId} suburbs={projected.suburbs} />
      </g>
      <SuburbLabels
        height={height}
        suburbs={projected.suburbs}
        transform={transform}
        width={width}
      />
    </svg>
  )
}

interface LandPathsProps {
  suburbs: ProjectedSuburb[]
}

// Plain land under the parks and water, joined into one path so it's cheap.
function LandPaths({ suburbs }: LandPathsProps) {
  const d = useMemo(() => suburbs.map((s) => s.d).join(""), [suburbs])
  return <path className="fill-map-land" d={d} />
}

interface VisitedPathsProps {
  suburbs: ProjectedSuburb[]
  visitedIds: ReadonlySet<string>
}

// Over the parks and water, so a visited suburb is filled edge to edge. One
// joined path keeps it cheap.
function VisitedPaths({ suburbs, visitedIds }: VisitedPathsProps) {
  const d = useMemo(
    () =>
      suburbs
        .filter((s) => visitedIds.has(s.id))
        .map((s) => s.d)
        .join(""),
    [suburbs, visitedIds],
  )
  return d ? <path className="fill-map-visited" d={d} /> : null
}

interface LandusePathsProps {
  landuse: ProjectedLanduse[]
}

function LandusePaths({ landuse }: LandusePathsProps) {
  return landuse.map((l) => (
    <path className={LANDUSE_FILL[l.kind]} d={l.d} key={l.kind} />
  ))
}

interface SuburbPathsProps {
  suburbs: ProjectedSuburb[]
  selectedId: string | null
  onSelect: (id: string) => void
}

// Transparent on top of the land use, so borders and hover show over parks.
// Hover is an outline rather than a fill so it still reads on visited green.
// Clicks reach the SVG's handler through `data-suburb-id`.
function SuburbPaths({ suburbs, selectedId, onSelect }: SuburbPathsProps) {
  return (
    <g
      className="fill-transparent stroke-map-border"
      strokeLinejoin="round"
      strokeWidth={0.75}
    >
      {suburbs.map((s) => (
        <path
          aria-label={s.name}
          aria-pressed={s.id === selectedId}
          className="cursor-pointer outline-none hover:stroke-map-label hover:stroke-2 focus-visible:stroke-ring focus-visible:stroke-2"
          d={s.d}
          data-suburb-id={s.id}
          key={s.id}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onSelect(s.id)
            }
          }}
          // A <button> can't live inside an SVG, so the path takes its role.
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
          role="button"
          tabIndex={0}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  )
}

interface SelectedOutlineProps {
  suburbs: ProjectedSuburb[]
  selectedId: string | null
}

// SVG has no z-index, so the selected suburb is drawn again last to keep its
// outline above the neighbouring borders.
function SelectedOutline({ suburbs, selectedId }: SelectedOutlineProps) {
  const selected = suburbs.find((s) => s.id === selectedId)
  if (!selected) {
    return null
  }
  return (
    <path
      className="pointer-events-none stroke-foreground"
      d={selected.d}
      fill="none"
      strokeLinejoin="round"
      strokeWidth={2.5}
      vectorEffect="non-scaling-stroke"
    />
  )
}

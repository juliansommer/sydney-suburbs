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
  useRef,
  useState,
} from "react"

import { useElementSize } from "@/hooks/use-element-size"
import { type Bounds, fitBounds } from "@/lib/zoom"
import type { LanduseKind, SuburbMapData } from "@/types/suburb"

import { projectMap, type ProjectedSuburb } from "./project"
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
  const projected = projectMap(data, width, height)
  const visitedD = projected.suburbs
    .filter((s) => visitedIds.has(s.id))
    .map((s) => s.d)
    .join("")
  const zoomer = useRef<Zoomer | null>(null)

  const [outlinedLga, setOutlinedLga] = useState<string | null>(null)

  // Picking the selected suburb again closes it, like the close button.
  function pick(id: string | null) {
    const next = id === selectedId ? null : id
    if (next) {
      setOutlinedLga(null)
    }
    onSelect(next)
  }

  function zoomToBounds(bounds: Bounds, animate: boolean, minZoom?: number) {
    if (!zoomer.current) {
      return
    }
    const { selection, behaviour } = zoomer.current
    const { x, y, k } = fitBounds(bounds, width, height, minZoom)
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
    const suburb = projected.suburbs.find((s) => s.id === id)
    if (suburb) {
      zoomToBounds(suburb.bounds, animate)
    }
  }

  useImperativeHandle(ref, () => ({
    zoomTo: (id) => {
      setOutlinedLga(null)
      zoomTo(id, true)
    },
    zoomToCouncil: (lga) => {
      const council = projected.councils.find((c) => c.lga === lga)
      if (!council) {
        return
      }
      // A whole council can be too big for the 2x minimum meant for suburbs.
      zoomToBounds(council.bounds, true, 1)
      setOutlinedLga(lga)
    },
  }))

  const onDrawn = useEffectEvent(() => {
    if (selectedId) {
      zoomTo(selectedId, false)
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
      const extent: [[number, number], [number, number]] = [
        [0, 0],
        [width, height],
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
          if (event.transform !== startTransform) {
            setGesture((n) => n + 1)
          }
        })
      const selection = select(svg)
      // A click toggles a suburb, so a quick select-then-close would otherwise
      // read as a double-click and zoom in.
      selection.call(behaviour).on("dblclick.zoom", null)
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
          pick(suburb?.dataset.suburbId ?? null)
        }
      }}
      ref={svgRef}
      width={width}
    >
      <rect className="fill-map-water" height={height} width={width} />
      <g key={gesture} transform={transform.toString()}>
        <path className="fill-map-surrounds" d={projected.surrounds} />
        {/* Plain land under the parks and water, joined into one path so it's cheap. */}
        <path
          className="fill-map-land"
          d={projected.suburbs.map((s) => s.d).join("")}
        />
        {projected.landuse.map((l) => (
          <path className={LANDUSE_FILL[l.kind]} d={l.d} key={l.kind} />
        ))}
        {/* Over the parks and water, so a visited suburb is filled edge to edge. */}
        {visitedD ? <path className="fill-map-visited" d={visitedD} /> : null}
        <SuburbPaths
          onSelect={pick}
          selectedId={selectedId}
          suburbs={projected.suburbs}
        />
        <Outline
          d={projected.councils.find((c) => c.lga === outlinedLga)?.d}
          strokeWidth={3}
        />
        {/* SVG has no z-index, so the selected suburb is drawn again last to
            keep its outline above the neighbouring borders. */}
        <Outline
          d={projected.suburbs.find((s) => s.id === selectedId)?.d}
          strokeWidth={2.5}
        />
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

interface OutlineProps {
  d: string | undefined
  strokeWidth: number
}

function Outline({ d, strokeWidth }: OutlineProps) {
  if (!d) {
    return null
  }
  return (
    <path
      className="pointer-events-none stroke-foreground"
      d={d}
      fill="none"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      vectorEffect="non-scaling-stroke"
    />
  )
}

import { select } from "d3-selection"
import { type D3ZoomEvent, zoom, zoomIdentity } from "d3-zoom"
import { useCallback, useMemo, useState } from "react"

import { useElementSize } from "@/hooks/use-element-size"
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
}

// Fills its container. The map is drawn once the container has a size.
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
      selection.call(behaviour)
      return () => {
        selection.on(".zoom", null)
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
        <LandPaths suburbs={projected.suburbs} visitedIds={visitedIds} />
        <LandusePaths landuse={projected.landuse} />
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
  visitedIds: ReadonlySet<string>
}

// Land under the parks and water, so a park still reads as a park inside a
// visited suburb. One joined path per fill keeps it cheap.
function LandPaths({ suburbs, visitedIds }: LandPathsProps) {
  const [land, visited] = useMemo(() => {
    const plain: string[] = []
    const seen: string[] = []
    for (const s of suburbs) {
      if (visitedIds.has(s.id)) {
        seen.push(s.d)
      } else {
        plain.push(s.d)
      }
    }
    return [plain.join(""), seen.join("")]
  }, [suburbs, visitedIds])
  return (
    <>
      <path className="fill-map-land" d={land} />
      {visited ? <path className="fill-map-visited" d={visited} /> : null}
    </>
  )
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

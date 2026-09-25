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

const LANDUSE_FILL: Record<LanduseKind, string> = {
  parkland: "fill-map-surrounds",
  water: "fill-map-water",
}

interface SuburbMapProps {
  data: SuburbMapData
}

// Fills its container. The map is drawn once the container has a size.
export function SuburbMap({ data }: SuburbMapProps) {
  const [ref, size] = useElementSize()
  return (
    <div className="size-full" ref={ref}>
      {size && size.width > 0 && size.height > 0 ? (
        <ZoomableMap data={data} height={size.height} width={size.width} />
      ) : null}
    </div>
  )
}

interface ZoomableMapProps extends SuburbMapProps {
  width: number
  height: number
}

function ZoomableMap({ data, width, height }: ZoomableMapProps) {
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
      const behaviour = zoom<SVGSVGElement, unknown>()
        .extent(extent)
        .translateExtent(extent)
        .scaleExtent([1, MAX_ZOOM])
        .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
          setTransform(event.transform)
        })
        .on("end", () => {
          setGesture((n) => n + 1)
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
    <svg
      aria-label="Map of Sydney suburbs"
      className="block touch-none select-none"
      height={height}
      ref={svgRef}
      width={width}
    >
      <rect className="fill-map-water" height={height} width={width} />
      <g key={gesture} transform={transform.toString()}>
        <path className="fill-map-surrounds" d={projected.surrounds} />
        <LandPaths suburbs={projected.suburbs} />
        <LandusePaths landuse={projected.landuse} />
        <SuburbPaths suburbs={projected.suburbs} />
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
}

// Plain land under the parks and water, joined into one path so it's cheap.
function LandPaths({ suburbs }: SuburbPathsProps) {
  const d = useMemo(() => suburbs.map((s) => s.d).join(""), [suburbs])
  return <path className="fill-map-land" d={d} />
}

interface LandusePathsProps {
  landuse: ProjectedLanduse[]
}

function LandusePaths({ landuse }: LandusePathsProps) {
  return landuse.map((l) => (
    <path className={LANDUSE_FILL[l.kind]} d={l.d} key={l.kind} />
  ))
}

// Transparent on top of the land use, so borders and hover show over parks.
function SuburbPaths({ suburbs }: SuburbPathsProps) {
  return (
    <g
      className="fill-transparent stroke-map-border"
      strokeLinejoin="round"
      strokeWidth={0.75}
    >
      {suburbs.map((s) => (
        <path
          aria-label={s.name}
          className="hover:fill-map-label/10"
          d={s.d}
          key={s.id}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  )
}

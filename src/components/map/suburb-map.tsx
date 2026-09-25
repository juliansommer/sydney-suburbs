import { select } from "d3-selection"
import { type D3ZoomEvent, zoom, zoomIdentity } from "d3-zoom"
import { useCallback, useMemo, useState } from "react"

import { useElementSize } from "@/hooks/use-element-size"
import type { SuburbFeature } from "@/types/suburb"

import { projectSuburbs, type ProjectedSuburb } from "./project"
import { SuburbLabels } from "./suburb-labels"

const MAX_ZOOM = 40

interface SuburbMapProps {
  suburbs: SuburbFeature[]
}

// Fills its container. The map is drawn once the container has a size.
export function SuburbMap({ suburbs }: SuburbMapProps) {
  const [ref, size] = useElementSize()
  return (
    <div className="size-full" ref={ref}>
      {size && size.width > 0 && size.height > 0 ? (
        <ZoomableMap
          height={size.height}
          suburbs={suburbs}
          width={size.width}
        />
      ) : null}
    </div>
  )
}

interface ZoomableMapProps extends SuburbMapProps {
  width: number
  height: number
}

function ZoomableMap({ suburbs, width, height }: ZoomableMapProps) {
  const [transform, setTransform] = useState(zoomIdentity)
  const projected = useMemo(
    () => projectSuburbs(suburbs, width, height),
    [suburbs, width, height],
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
      <g transform={transform.toString()}>
        <SuburbPaths suburbs={projected} />
        <SuburbLabels k={transform.k} suburbs={projected} />
      </g>
    </svg>
  )
}

interface SuburbPathsProps {
  suburbs: ProjectedSuburb[]
}

function SuburbPaths({ suburbs }: SuburbPathsProps) {
  return (
    <g
      className="fill-map-land stroke-map-border"
      strokeLinejoin="round"
      strokeWidth={0.75}
    >
      {suburbs.map((s) => (
        <path
          aria-label={s.name}
          className="hover:fill-map-hover"
          d={s.d}
          key={s.id}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  )
}

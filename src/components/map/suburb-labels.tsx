import type { ZoomTransform } from "d3-zoom"

import { labelVisible, placeLabels } from "@/lib/labels"

import type { ProjectedSuburb } from "./project"

const FONT_SIZE = 11
const HALO_WIDTH = 3

interface SuburbLabelsProps {
  suburbs: ProjectedSuburb[]
  transform: ZoomTransform
  width: number
  height: number
}

// Drawn in screen space, outside the zoomed group, so text is never scaled
// and stays sharp. Labels off screen are skipped, and overlapping ones give
// way to higher priority neighbours.
export function SuburbLabels({
  suburbs,
  transform,
  width,
  height,
}: SuburbLabelsProps) {
  const candidates = suburbs.flatMap((s) => {
    if (!s.label || !labelVisible(s, transform.k, FONT_SIZE)) {
      return []
    }
    const [x, y] = transform.apply(s.label)
    const offScreen = x < 0 || x > width || y < 0 || y > height
    return offScreen ? [] : [{ ...s, x, y }]
  })

  return (
    <g
      className="pointer-events-none fill-map-label stroke-map-halo [paint-order:stroke]"
      dominantBaseline="central"
      fontSize={FONT_SIZE}
      strokeLinejoin="round"
      strokeWidth={HALO_WIDTH}
      textAnchor="middle"
    >
      {placeLabels(candidates, FONT_SIZE).map((c) => (
        <text key={c.id} x={c.x} y={c.y}>
          {c.name}
        </text>
      ))}
    </g>
  )
}

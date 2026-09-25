import type { ZoomTransform } from "d3-zoom"

import { labelFits } from "@/lib/labels"

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
// and stays sharp. Labels off screen are skipped.
export function SuburbLabels({
  suburbs,
  transform,
  width,
  height,
}: SuburbLabelsProps) {
  return (
    <g
      className="pointer-events-none fill-map-label stroke-map-halo [paint-order:stroke]"
      dominantBaseline="central"
      fontSize={FONT_SIZE}
      strokeLinejoin="round"
      strokeWidth={HALO_WIDTH}
      textAnchor="middle"
    >
      {suburbs.map((s) => {
        if (!s.label || !labelFits(s, transform.k, s.name, FONT_SIZE)) {
          return null
        }
        const [x, y] = transform.apply(s.label)
        if (x < 0 || x > width || y < 0 || y > height) {
          return null
        }
        return (
          <text key={s.id} x={x} y={y}>
            {s.name}
          </text>
        )
      })}
    </g>
  )
}

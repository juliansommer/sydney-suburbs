import { labelFits } from "@/lib/labels"

import type { ProjectedSuburb } from "./project"

const FONT_SIZE = 11
const HALO_WIDTH = 3

interface SuburbLabelsProps {
  suburbs: ProjectedSuburb[]
  k: number
}

// Sizes are divided by the zoom factor so text stays the same size on screen.
export function SuburbLabels({ suburbs, k }: SuburbLabelsProps) {
  return (
    <g
      className="pointer-events-none fill-map-label stroke-map-halo [paint-order:stroke]"
      dominantBaseline="central"
      fontSize={FONT_SIZE / k}
      strokeLinejoin="round"
      strokeWidth={HALO_WIDTH / k}
      textAnchor="middle"
    >
      {suburbs.map((s) =>
        s.label && labelFits(s, k, s.name, FONT_SIZE) ? (
          <text key={s.id} x={s.label[0]} y={s.label[1]}>
            {s.name}
          </text>
        ) : null,
      )}
    </g>
  )
}

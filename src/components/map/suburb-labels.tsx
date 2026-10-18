import type { ZoomTransform } from "d3-zoom"
import { createMemo, For } from "solid-js"

import { labelVisible, placeLabels, type Rect } from "@/lib/labels"

import type { ProjectedSuburb } from "./project"

const FONT_SIZE = 11
const HALO_WIDTH = 3

interface SuburbLabelsProps {
  suburbs: ProjectedSuburb[]
  transform: ZoomTransform
  width: number
  height: number
  // Screen space already taken, which labels give way to.
  obstacles?: readonly Rect[]
}

// Drawn in screen space, outside the zoomed group, so text is never scaled
// and stays sharp. Labels off screen are skipped, and overlapping ones give
// way to higher priority neighbours.
export function SuburbLabels(props: SuburbLabelsProps) {
  const placed = createMemo(() => {
    const { transform, width, height } = props

    const candidates = props.suburbs.flatMap((s) => {
      if (!s.label || !labelVisible(s, transform.k, FONT_SIZE)) {
        return []
      }

      const [x, y] = transform.apply(s.label)
      const offScreen = x < 0 || x > width || y < 0 || y > height

      return offScreen ? [] : [{ ...s, x, y }]
    })

    return placeLabels(candidates, FONT_SIZE, props.obstacles)
  })

  return (
    <g
      class="pointer-events-none fill-map-label stroke-map-halo [paint-order:stroke]"
      dominant-baseline="central"
      font-size={FONT_SIZE}
      stroke-linejoin="round"
      stroke-width={HALO_WIDTH}
      text-anchor="middle"
    >
      {/* Keyed by suburb, so a zoom frame moves existing labels. */}
      <For each={placed()} keyed={(c) => c.id}>
        {(c) => (
          <text x={c().x} y={c().y}>
            {c().name}
          </text>
        )}
      </For>
    </g>
  )
}

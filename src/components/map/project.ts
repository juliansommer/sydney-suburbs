import { geoMercator, geoPath } from "d3-geo"

import type { SuburbFeature } from "@/types/suburb"

export interface ProjectedSuburb {
  id: string
  name: string
  d: string
  width: number
  height: number
  label: [number, number] | null
}

// Fits the suburbs to the viewport and projects them to SVG path strings,
// bounding box sizes and label positions, all in unzoomed pixels.
export function projectSuburbs(
  suburbs: SuburbFeature[],
  width: number,
  height: number,
): ProjectedSuburb[] {
  const projection = geoMercator().fitSize([width, height], {
    type: "FeatureCollection",
    features: suburbs,
  })
  const path = geoPath(projection)
  return suburbs.map((s) => {
    const [[x0, y0], [x1, y1]] = path.bounds(s)
    return {
      id: s.properties.id,
      name: s.properties.name,
      d: path(s) ?? "",
      width: x1 - x0,
      height: y1 - y0,
      label: projection([s.properties.lx, s.properties.ly]),
    }
  })
}

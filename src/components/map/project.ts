import {
  type GeoPermissibleObjects,
  type GeoProjection,
  geoMercator,
  geoPath,
  geoTransform,
} from "d3-geo"

import type { Bounds } from "@/lib/zoom"
import type { MapLayers } from "@/types/map-layers"
import type { LanduseKind, SuburbMapData } from "@/types/suburb"

export interface ProjectedSuburb {
  id: string
  name: string
  d: string
  bounds: Bounds
  width: number
  height: number
  label: [number, number] | null
}

export interface ProjectedCouncil {
  lga: string
  d: string
  bounds: Bounds
}

export interface ProjectedLanduse {
  kind: LanduseKind
  d: string
}

export interface ProjectedFill {
  key: string
  d: string
  className: string
  image?: string
  // Each suburb's path on its own, for an image fill.
  parts: { id: string; d: string }[]
}

export interface ProjectedOutline {
  key: string
  d: string
}

export interface ProjectedMarker {
  key: string
  x: number
  y: number
  src: string
  label: string
}

export interface ProjectedBase {
  projection: GeoProjection
  suburbs: ProjectedSuburb[]
  councils: ProjectedCouncil[]
  surrounds: string
  land: string
  landuse: ProjectedLanduse[]
}

export interface ProjectedLayers {
  fills: ProjectedFill[]
  outlines: ProjectedOutline[]
  markers: ProjectedMarker[]
}

// d3's default scale, which fitting multiplies up from.
const BASE_SCALE = 150

// Runs points straight through the projection maths. The map never crosses
// the antimeridian and its edges are too short to curve, so d3's clipping and
// resampling change nothing and only cost time. The paths come out identical.
function planarPath(projection: GeoProjection) {
  return geoPath(
    geoTransform({
      point(lon: number, lat: number) {
        const point = projection([lon, lat])

        if (point) {
          this.stream.point(point[0], point[1])
        }
      },
    }),
  )
}

// The same maths as d3's fitSize, measured with the planar path.
function fitMercator(
  object: GeoPermissibleObjects,
  width: number,
  height: number,
): GeoProjection {
  const projection = geoMercator().scale(BASE_SCALE).translate([0, 0])
  const [[x0, y0], [x1, y1]] = planarPath(projection).bounds(object)
  const k = Math.min(width / (x1 - x0), height / (y1 - y0))

  return projection
    .scale(BASE_SCALE * k)
    .translate([(width - k * (x1 + x0)) / 2, (height - k * (y1 + y0)) / 2])
}

// Fits the suburbs to the viewport and projects the base map to SVG path
// strings, bounding box sizes and label positions, all in unzoomed pixels.
export function projectBase(
  { suburbs, councils, surrounds, land, landuse }: SuburbMapData,
  width: number,
  height: number,
): ProjectedBase {
  const projection = fitMercator(
    { type: "FeatureCollection", features: suburbs },
    width,
    height,
  )

  const path = planarPath(projection)

  const projectedSuburbs = suburbs.map((s) => {
    const bounds = path.bounds(s)
    const [[x0, y0], [x1, y1]] = bounds

    return {
      id: s.properties.id,
      name: s.properties.name,
      d: path(s) ?? "",
      bounds,
      width: x1 - x0,
      height: y1 - y0,
      label: projection([s.properties.lx, s.properties.ly]),
    }
  })

  return {
    projection,
    suburbs: projectedSuburbs,
    councils: councils.map((c) => ({
      lga: c.properties.lga,
      d: path(c) ?? "",
      bounds: path.bounds(c),
    })),
    surrounds: path(surrounds) ?? "",
    land: path(land) ?? "",
    landuse: landuse.map((l) => ({
      kind: l.properties.kind,
      d: path(l) ?? "",
    })),
  }
}

// Separate from the base so changing layers skips re-projecting every
// suburb. Fills reuse the projected suburb paths.
export function projectLayers(
  { fills, outlines, markers }: MapLayers,
  { suburbs, projection }: ProjectedBase,
): ProjectedLayers {
  const path = planarPath(projection)

  return {
    fills: fills.map((f) => {
      const parts = suburbs
        .filter((s) => f.ids.has(s.id))
        .map((s) => ({ id: s.id, d: s.d }))

      return {
        key: f.key,
        className: f.className,
        image: f.image,
        d: parts.map((p) => p.d).join(""),
        parts: f.image ? parts : [],
      }
    }),
    outlines: outlines.map((o) => ({ key: o.key, d: path(o.feature) ?? "" })),
    markers: markers.flatMap((m) => {
      const point = projection(m.coords)

      return point
        ? [{ key: m.key, x: point[0], y: point[1], src: m.src, label: m.label }]
        : []
    }),
  }
}

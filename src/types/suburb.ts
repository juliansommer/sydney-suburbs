import type { Feature, MultiPolygon, Polygon } from "geojson"

export interface SuburbProperties {
  id: string
  name: string
  lga: string
  // Label point (lon/lat), precomputed by scripts/build-suburbs.ts.
  lx: number
  ly: number
}

export type SuburbFeature = Feature<Polygon | MultiPolygon, SuburbProperties>

// Land around and under the suburbs, drawn behind them.
export type Surrounds = Feature<Polygon | MultiPolygon>

export type LanduseKind = "parkland" | "water"

// Parks and water inside the mapped suburbs, one feature per kind.
export type Landuse = Feature<Polygon | MultiPolygon, { kind: LanduseKind }>

export interface SuburbMapData {
  suburbs: SuburbFeature[]
  surrounds: Surrounds
  landuse: Landuse[]
}

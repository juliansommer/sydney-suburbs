import type { Feature, MultiPolygon, Polygon } from "geojson"

// Suburbs filled in one colour, drawn over the land use.
export interface FillLayer {
  key: string
  ids: ReadonlySet<string>
  // A Tailwind fill class.
  className: string
  // A picture covering each suburb in the layer, in place of the fill colour.
  image?: string
}

// A merged shape outlined over the suburb borders.
export interface OutlineLayer {
  key: string
  feature: Feature<Polygon | MultiPolygon>
}

// An image pinned to a lon/lat point, drawn at a fixed size on screen.
export interface MapMarker {
  key: string
  coords: [number, number]
  src: string
  label: string
}

export interface MapLayers {
  fills: FillLayer[]
  outlines: OutlineLayer[]
  markers: MapMarker[]
}

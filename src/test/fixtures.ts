import type { Topology } from "topojson-specification"

function square(x: number, y: number): [number, number][] {
  return [
    [x, y],
    [x + 0.01, y],
    [x + 0.01, y - 0.01],
    [x, y - 0.01],
    [x, y],
  ]
}

// Three unquantised square suburbs side by side near the CBD, plus a square
// of surrounding land.
export const suburbsTopology: Topology = {
  type: "Topology",
  arcs: [
    square(151.2, -33.8),
    square(151.21, -33.8),
    square(151.22, -33.8),
    square(151.19, -33.79),
  ],
  objects: {
    suburbs: {
      type: "GeometryCollection",
      geometries: [
        {
          type: "Polygon",
          arcs: [[0]],
          properties: {
            id: "1",
            name: "Alpha",
            lga: "Sydney",
            lx: 151.205,
            ly: -33.805,
          },
        },
        {
          type: "Polygon",
          arcs: [[1]],
          properties: {
            id: "2",
            name: "Beta",
            lga: "Sydney",
            lx: 151.215,
            ly: -33.805,
          },
        },
        {
          type: "Polygon",
          arcs: [[2]],
          properties: {
            id: "3",
            name: "Gamma",
            lga: "Sydney",
            lx: 151.225,
            ly: -33.805,
          },
        },
      ],
    },
    surrounds: {
      type: "GeometryCollection",
      geometries: [{ type: "Polygon", arcs: [[3]] }],
    },
  },
}

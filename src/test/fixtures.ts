import type { MapTopology } from "@/queries/suburbs-topo"
import type { SuburbFactsFile } from "@/types/suburb-facts"

function square(x: number, y: number): [number, number][] {
  return [
    [x, y],
    [x + 0.01, y],
    [x + 0.01, y - 0.01],
    [x, y - 0.01],
    [x, y],
  ]
}

// Three unquantised square suburbs side by side near the CBD, a square of
// surrounding land, and a park inside the first suburb.
export const suburbsTopology: MapTopology = {
  type: "Topology",
  arcs: [
    square(151.2, -33.8),
    square(151.21, -33.8),
    square(151.22, -33.8),
    square(151.19, -33.79),
    square(151.203, -33.803),
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
    landuse: {
      type: "GeometryCollection",
      geometries: [
        { type: "Polygon", arcs: [[4]], properties: { kind: "parkland" } },
      ],
    },
  },
}

// Alpha has everything, Beta has no photo or summary, and Gamma is missing.
export const suburbFacts: SuburbFactsFile = {
  "1": {
    population: 15_301,
    postcode: "2042",
    summary: "A harbourside suburb of the Inner West, known for its parks.",
    stats: {
      medianAge: 34,
      medianRent: 650,
      medianHouseholdIncome: 2450,
      bornOverseas: 31,
      areaKm2: 2.1,
      density: 7286,
      cbdDistanceKm: 5.3,
    },
    photo: {
      url: "https://example.public.blob.vercel-storage.com/suburbs/1-abcd1234.webp",
      width: 800,
      height: 533,
      artist: "Jane Smith",
      licence: "CC BY-SA 4.0",
      licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Alpha.jpg",
    },
  },
  "2": {
    population: 0,
    postcode: "2000",
    summary: null,
    stats: {
      medianAge: null,
      medianRent: null,
      medianHouseholdIncome: null,
      bornOverseas: null,
      areaKm2: 0.42,
      density: null,
      cbdDistanceKm: 0.8,
    },
    photo: null,
  },
}

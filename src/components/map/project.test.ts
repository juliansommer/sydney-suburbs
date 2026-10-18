import { geoMercator, geoPath } from "d3-geo"
import { describe, expect, it } from "vitest"

import { toSuburbMap } from "@/queries/suburbs-topo"
import { suburbsTopology } from "@/test/fixtures"

import { projectBase } from "./project"

describe("projectBase", () => {
  it("draws the same paths and bounds as d3's own projection", () => {
    const data = toSuburbMap(suburbsTopology)

    const projection = geoMercator().fitSize([800, 600], {
      type: "FeatureCollection",
      features: data.suburbs,
    })

    const path = geoPath(projection)

    const projected = projectBase(data, 800, 600)

    expect(projected.suburbs.map((s) => [s.d, s.bounds])).toStrictEqual(
      data.suburbs.map((s) => [path(s), path.bounds(s)]),
    )
    expect(projected.land).toBe(path(data.land))
    expect(projected.councils.map((c) => c.d)).toStrictEqual(
      data.councils.map((c) => path(c)),
    )
  })
})

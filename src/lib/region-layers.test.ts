import { describe, expect, it } from "vitest"

import { toSuburbMap } from "@/queries/suburbs-topo"
import { suburbsTopology } from "@/test/fixtures"

import { regionLayers } from "./region-layers"
import { EMPTY_REGION_MAP, type RegionMap } from "./regions"

const map: RegionMap = {
  ...EMPTY_REGION_MAP,
  regions: [
    { id: "a", name: "Harbour", color: "#4363d8", suburbIds: ["1", "2"] },
    { id: "empty", name: "Nothing", color: "#f58231", suburbIds: [] },
  ],
}

describe("regionLayers", () => {
  it("fills, outlines and names each region with suburbs", () => {
    const layers = regionLayers(map, toSuburbMap(suburbsTopology))

    expect(layers.fills).toStrictEqual([
      { key: "a", ids: new Set(["1", "2"]), color: "#4363d8" },
    ])
    expect(layers.outlines.map((o) => o.key)).toStrictEqual(["a"])
    expect(layers.labels?.map((l) => l.text)).toStrictEqual(["Harbour"])
  })
})

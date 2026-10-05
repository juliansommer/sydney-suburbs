import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { CLUB_IDS } from "@/data/nrl-territories"
import { type MapTopology, toSuburbMap } from "@/queries/suburbs-topo"
import { suburbsTopology } from "@/test/fixtures"

import { nrlLayers } from "./nrl"

const sydney = toSuburbMap(
  JSON.parse(
    readFileSync("public/sydney-suburbs.topo.json", "utf-8"),
  ) as MapTopology,
)

describe("nrlLayers", () => {
  it("fills and outlines every club, with at least one logo each", () => {
    const { fills, outlines, markers } = nrlLayers(sydney)

    expect(fills.map((f) => f.key)).toStrictEqual(CLUB_IDS)
    expect(outlines.map((o) => o.key)).toStrictEqual(CLUB_IDS)
    const withoutLogo = CLUB_IDS.filter(
      (club) => !markers.some((m) => m.key.startsWith(`${club}-`)),
    )
    expect(withoutLogo).toStrictEqual([])
  })

  it("gives each separate piece of the Wests Tigers its own logo", () => {
    const { markers } = nrlLayers(sydney)

    // The inner west, Ryde across the river, and Macarthur.
    expect(
      markers.filter((m) => m.key.startsWith("wests-tigers-")),
    ).toHaveLength(3)
  })

  it("gives tiny territories no logo", () => {
    const { fills, markers } = nrlLayers(toSuburbMap(suburbsTopology))

    expect(fills).toHaveLength(1)
    expect(markers).toStrictEqual([])
  })
})

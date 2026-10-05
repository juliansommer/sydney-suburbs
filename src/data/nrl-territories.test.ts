import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { type MapTopology, toSuburbMap } from "@/queries/suburbs-topo"

import {
  CLUB_IDS,
  clubFor,
  LGA_CLUBS,
  SUBURB_OVERRIDES,
} from "./nrl-territories"

const suburbs = toSuburbMap(
  JSON.parse(
    readFileSync("public/sydney-suburbs.topo.json", "utf-8"),
  ) as MapTopology,
).suburbs.map((s) => s.properties)

describe("NRL territories", () => {
  it("gives every council on the map a default club", () => {
    const lgas = new Set(suburbs.map((s) => s.lga))

    expect([...lgas].filter((lga) => !LGA_CLUBS.has(lga))).toStrictEqual([])
    expect([...LGA_CLUBS.keys()].filter((lga) => !lgas.has(lga))).toStrictEqual(
      [],
    )
  })

  it("only overrides suburbs that exist, to a different club", () => {
    const byName = new Map(suburbs.map((s) => [s.name, s]))
    const pointless = [...SUBURB_OVERRIDES].filter(([name, club]) => {
      const suburb = byName.get(name)
      return !suburb || LGA_CLUBS.get(suburb.lga) === club
    })

    expect(pointless).toStrictEqual([])
  })

  it("puts every suburb in a club, and every club on the map", () => {
    const clubs = suburbs.map((s) => clubFor(s))

    expect(clubs).not.toContain(undefined)
    expect(new Set(clubs)).toStrictEqual(new Set(CLUB_IDS))
  })
})

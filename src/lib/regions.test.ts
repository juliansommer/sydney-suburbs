import { describe, expect, it } from "vitest"

import {
  DEFAULT_TITLE,
  EMPTY_REGION_MAP,
  nextRegionColor,
  nextRegionName,
  parseRegionMap,
  type Region,
  REGION_PALETTE,
  regionBySuburb,
  type RegionMap,
  regionReducer,
} from "./regions"

function region(id: string, suburbIds: string[] = []): Region {
  return { id, name: `Name ${id}`, color: "#e6194b", suburbIds }
}

function mapOf(...regions: Region[]): RegionMap {
  return { ...EMPTY_REGION_MAP, regions }
}

const KNOWN = new Set(["1", "2", "3"])

describe("regionReducer", () => {
  it("adds a region, taking its suburbs from any other", () => {
    const next = regionReducer(mapOf(region("a", ["1", "2"])), {
      type: "addRegion",
      region: region("b", ["2", "3"]),
    })

    expect(next.regions).toStrictEqual([
      region("a", ["1"]),
      region("b", ["2", "3"]),
    ])
  })

  it("renames a region, trimmed, and ignores a blank name", () => {
    const map = mapOf(region("a"))

    const renamed = regionReducer(map, {
      type: "renameRegion",
      id: "a",
      name: "  Inner West ",
    })

    expect(renamed.regions[0]?.name).toBe("Inner West")
    expect(
      regionReducer(renamed, { type: "renameRegion", id: "a", name: "  " }),
    ).toBe(renamed)
  })

  it("recolours a region, ignoring anything but #rrggbb", () => {
    const map = mapOf(region("a"))

    const recoloured = regionReducer(map, {
      type: "recolorRegion",
      id: "a",
      color: "#123abc",
    })

    expect(recoloured.regions[0]?.color).toBe("#123abc")
    expect(
      regionReducer(map, { type: "recolorRegion", id: "a", color: "red" }),
    ).toBe(map)
  })

  it("deletes a region", () => {
    const next = regionReducer(mapOf(region("a", ["1"]), region("b")), {
      type: "deleteRegion",
      id: "a",
    })

    expect(next.regions.map((r) => r.id)).toStrictEqual(["b"])
  })

  it("moves a region within the legend, stopping at the ends", () => {
    const map = mapOf(region("a"), region("b"), region("c"))
    const down = regionReducer(map, { type: "moveRegion", id: "a", by: 1 })

    expect(down.regions.map((r) => r.id)).toStrictEqual(["b", "a", "c"])
    expect(regionReducer(map, { type: "moveRegion", id: "a", by: -1 })).toBe(
      map,
    )
  })

  it("toggles a suburb in and out of a region", () => {
    const map = mapOf(region("a"))

    const added = regionReducer(map, {
      type: "toggleSuburb",
      regionId: "a",
      suburbId: "1",
    })

    const removed = regionReducer(added, {
      type: "toggleSuburb",
      regionId: "a",
      suburbId: "1",
    })

    expect(added.regions[0]?.suburbIds).toStrictEqual(["1"])
    expect(removed.regions[0]?.suburbIds).toStrictEqual([])
  })

  it("moves a toggled suburb from the region it was in", () => {
    const next = regionReducer(mapOf(region("a", ["1"]), region("b")), {
      type: "toggleSuburb",
      regionId: "b",
      suburbId: "1",
    })

    expect(regionBySuburb(next).get("1")?.id).toBe("b")
    expect(next.regions[0]?.suburbIds).toStrictEqual([])
  })

  it("adds a council overlapping another region without painting twice", () => {
    const next = regionReducer(
      mapOf(region("a", ["1", "2"]), region("b", ["3"])),
      {
        type: "addSuburbs",
        regionId: "b",
        suburbIds: ["2", "3"],
      },
    )

    expect(next.regions[0]?.suburbIds).toStrictEqual(["1"])
    expect(next.regions[1]?.suburbIds).toStrictEqual(["2", "3"])
  })

  it("sets the title, capped at 60 characters", () => {
    const next = regionReducer(EMPTY_REGION_MAP, {
      type: "setTitle",
      title: "x".repeat(80),
    })

    expect(next.title).toHaveLength(60)
  })
})

describe("new region defaults", () => {
  it("names the next free Region N", () => {
    const map = mapOf({ ...region("a"), name: "Region 2" })

    expect(nextRegionName(map)).toBe("Region 3")
    expect(nextRegionName(EMPTY_REGION_MAP)).toBe("Region 1")
  })

  it("picks the first unused palette colour", () => {
    expect(nextRegionColor(EMPTY_REGION_MAP)).toBe(REGION_PALETTE[0])
    expect(nextRegionColor(mapOf(region("a")))).toBe(REGION_PALETTE[1])
  })
})

describe("parseRegionMap", () => {
  it("starts empty with nothing saved", () => {
    expect(parseRegionMap(null, KNOWN)).toStrictEqual({
      version: 1,
      title: DEFAULT_TITLE,
      regions: [],
    })
  })

  it("starts empty from corrupt or outdated data", () => {
    expect(parseRegionMap("{not json", KNOWN)).toBe(EMPTY_REGION_MAP)
    expect(
      parseRegionMap(JSON.stringify({ version: 0, regions: [] }), KNOWN),
    ).toBe(EMPTY_REGION_MAP)
    expect(
      parseRegionMap(
        JSON.stringify({ ...mapOf({ ...region("a"), color: "red" }) }),
        KNOWN,
      ),
    ).toBe(EMPTY_REGION_MAP)
  })

  it("drops suburbs the map no longer draws, and duplicates", () => {
    const saved = mapOf(region("a", ["1", "gone"]), region("b", ["1", "2"]))

    expect(parseRegionMap(JSON.stringify(saved), KNOWN).regions).toStrictEqual([
      region("a", ["1"]),
      region("b", ["2"]),
    ])
  })
})

import { describe, expect, it } from "vitest"

import { labelFits, labelVisible, placeLabels } from "./labels"

describe("labelFits", () => {
  const box = { width: 20, height: 10 }

  it("hides a label wider than its suburb", () => {
    expect(labelFits(box, 1, "Parramatta", 11)).toBeFalsy()
  })

  it("shows the label once zoomed in far enough", () => {
    expect(labelFits(box, 4, "Parramatta", 11)).toBeTruthy()
  })

  it("hides a label taller than its suburb", () => {
    expect(labelFits({ width: 200, height: 5 }, 1, "Ryde", 11)).toBeFalsy()
  })
})

describe("labelVisible", () => {
  const tiny = { width: 1, height: 1 }

  it("shows major centres fully zoomed out", () => {
    expect(labelVisible({ ...tiny, name: "Chatswood" }, 1, 11)).toBeTruthy()
  })

  it("holds back minor centres until their tier's zoom", () => {
    expect(labelVisible({ ...tiny, name: "Rhodes" }, 1, 11)).toBeFalsy()
    expect(labelVisible({ ...tiny, name: "Rhodes" }, 2, 11)).toBeTruthy()
  })

  it("falls back to fitting for other suburbs", () => {
    expect(labelVisible({ ...tiny, name: "Ryde" }, 1, 11)).toBeFalsy()
  })
})

function at(name: string, x: number, size = 10) {
  return { name, x, y: 0, width: size, height: size }
}

describe("placeLabels", () => {
  it("keeps the higher tier when labels overlap", () => {
    const placed = placeLabels([at("Ryde", 0, 100), at("Sydney", 5)], 11)
    expect(placed.map((l) => l.name)).toStrictEqual(["Sydney"])
  })

  it("prefers larger suburbs among untiered labels", () => {
    const placed = placeLabels([at("Alpha", 0), at("Beta", 5, 50)], 11)
    expect(placed.map((l) => l.name)).toStrictEqual(["Beta"])
  })

  it("keeps labels that don't overlap", () => {
    const placed = placeLabels([at("Alpha", 0), at("Beta", 200)], 11)
    expect(placed).toHaveLength(2)
  })
})

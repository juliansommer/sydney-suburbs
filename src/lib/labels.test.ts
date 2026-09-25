import { describe, expect, it } from "vitest"

import { labelFits } from "./labels"

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

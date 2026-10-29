import { describe, expect, it } from "vitest"

import { toSuburbMap } from "@/queries/suburbs-topo"
import { suburbsTopology } from "@/test/fixtures"

import {
  ABS_CREDIT,
  EXPORT_PALETTE,
  exportFileName,
  exportSvg,
} from "./export-png"
import { EMPTY_REGION_MAP, type RegionMap } from "./regions"

const map: RegionMap = {
  ...EMPTY_REGION_MAP,
  title: "South & East",
  regions: [
    { id: "a", name: "Harbour", color: "#4363d8", suburbIds: ["1", "2"] },
    { id: "b", name: "Beach", color: "#f58231", suburbIds: ["3"] },
  ],
}

function render(options = {}) {
  return exportSvg(toSuburbMap(suburbsTopology), map, {
    framing: "regions",
    suburbNames: false,
    ...options,
  })
}

describe("exportSvg", () => {
  it("has the title, a legend entry per region and the ABS credit", () => {
    const { svg } = render()

    expect(svg).toContain("South &amp; East")
    expect(svg).toContain("Harbour (2 suburbs)")
    expect(svg).toContain("Beach (1 suburb)")
    expect(svg).toContain(ABS_CREDIT)
  })

  it("uses literal colours only, with no classes or CSS variables", () => {
    const { svg } = render()

    expect(svg).toContain(`fill="${EXPORT_PALETTE.water}"`)
    expect(svg).not.toContain("class=")
    expect(svg).not.toContain("var(")
  })

  it("is 2400 pixels on the map's long edge", () => {
    const { width } = render()

    expect(width).toBe(2400)
  })

  it("names suburbs only when asked", () => {
    expect(render().svg).not.toContain(">Beta<")
    expect(render({ suburbNames: true }).svg).toContain(">Beta<")
  })

  it("embeds the font it's given", () => {
    const { svg } = render({ fontUrl: "data:font/woff2;base64,AAAA" })

    expect(svg).toContain("@font-face")
    expect(svg).toContain("data:font/woff2;base64,AAAA")
  })
})

describe("exportFileName", () => {
  it("slugs the title", () => {
    expect(exportFileName("South Sydney")).toBe("south-sydney-regions.png")
    expect(exportFileName("Sydney regions")).toBe("sydney-regions.png")
    expect(exportFileName("!!!")).toBe("sydney-regions.png")
  })
})

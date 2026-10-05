import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { toSuburbMap } from "@/queries/suburbs-topo"
import { suburbsTopology } from "@/test/fixtures"

import { SuburbMap } from "./suburb-map"

function renderMap(props: Partial<Parameters<typeof SuburbMap>[0]> = {}) {
  return render(
    <SuburbMap
      data={toSuburbMap(suburbsTopology)}
      onSelect={() => {}}
      selectedId={null}
      layers={{ fills: [], outlines: [], markers: [] }}
      {...props}
    />,
  )
}

describe("SuburbMap", () => {
  it("draws a labelled path for each suburb", () => {
    renderMap()

    for (const name of ["Alpha", "Beta", "Gamma"]) {
      expect(screen.getByRole("button", { name }).tagName).toBe("path")
    }
  })

  it("labels suburbs that are big enough on screen", () => {
    renderMap()

    expect(screen.getByText("Beta").tagName).toBe("text")
  })

  it("fills layer suburbs and marks the selected one", () => {
    const { container } = renderMap({
      selectedId: "2",
      layers: {
        fills: [
          {
            key: "visited",
            ids: new Set(["1"]),
            className: "fill-map-visited",
          },
        ],
        outlines: [],
        markers: [],
      },
    })

    expect(container.querySelector('[data-layer="visited"]')).toHaveAttribute(
      "d",
      screen.getByRole("button", { name: "Alpha" }).getAttribute("d"),
    )
    expect(screen.getByRole("button", { name: "Beta" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })
})

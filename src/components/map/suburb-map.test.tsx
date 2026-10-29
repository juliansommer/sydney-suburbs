import { render, screen } from "@solidjs/testing-library"
import { describe, expect, it } from "vitest"

import { toSuburbMap } from "@/queries/suburbs-topo"
import { suburbsTopology } from "@/test/fixtures"

import { SuburbMap } from "./suburb-map"

function renderMap(props: Partial<Parameters<typeof SuburbMap>[0]> = {}) {
  return render(() => (
    <SuburbMap
      data={toSuburbMap(suburbsTopology)}
      onSelect={() => {}}
      selectedId={null}
      layers={{ fills: [], outlines: [], markers: [] }}
      {...props}
    />
  ))
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

  it("fills colour layers through a custom property and outlines them", () => {
    const data = toSuburbMap(suburbsTopology)

    const { container } = renderMap({
      data,
      layers: {
        fills: [{ key: "harbour", ids: new Set(["1"]), color: "#4363d8" }],
        outlines: [
          {
            key: "harbour",
            feature: {
              type: "Feature",
              geometry: data.land.geometry,
              properties: {},
            },
          },
        ],
        markers: [],
      },
    })

    const fill = container.querySelector('[data-layer="harbour"]')

    expect(fill).toHaveClass("fill-region")
    expect(fill).toHaveStyle({ "--region": "#4363d8" })
    expect(container.querySelectorAll('path[fill="none"]')).toHaveLength(1)
  })

  it("names areas over dimmed suburb names", () => {
    const { container } = renderMap({
      layers: {
        fills: [],
        outlines: [],
        markers: [],
        labels: [
          {
            key: "harbour",
            text: "Harbour",
            coords: [151.215, -33.805],
            bounds: [
              [151.2, -33.81],
              [151.23, -33.8],
            ],
          },
        ],
      },
    })

    expect(screen.getByText("Harbour").parentElement).toHaveAttribute(
      "font-weight",
      "600",
    )
    expect(container.querySelector(".opacity-60")).not.toBeNull()
  })
})

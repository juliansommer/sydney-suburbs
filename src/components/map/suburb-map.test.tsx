import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { toSuburbMap } from "@/queries/suburbs-topo"
import { suburbsTopology } from "@/test/fixtures"

import { SuburbMap } from "./suburb-map"

describe("SuburbMap", () => {
  it("draws a labelled path for each suburb", () => {
    render(<SuburbMap data={toSuburbMap(suburbsTopology)} />)

    for (const name of ["Alpha", "Beta", "Gamma"]) {
      expect(screen.getByLabelText(name).tagName).toBe("path")
    }
  })

  it("labels suburbs that are big enough on screen", () => {
    render(<SuburbMap data={toSuburbMap(suburbsTopology)} />)

    expect(screen.getByText("Beta").tagName).toBe("text")
  })
})

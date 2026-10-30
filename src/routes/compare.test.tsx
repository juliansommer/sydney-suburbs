import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@solidjs/testing-library"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { signOut } from "@/test/auth"
import { mockFetch } from "@/test/mock-fetch"
import { renderRoute, WARM_UP_TIMEOUT_MS, warmUpMap } from "@/test/utils"

// base-ui-solid is transformed from source, which takes seconds cold.
async function loadLazyChunks() {
  await Promise.all([
    import("@/components/suburb-panel"),
    import("@/components/suburb-compare"),
    import("@/components/map/suburb-search"),
  ])
  await warmUpMap()
}

function suburb(name: string) {
  return screen.getByRole("button", { name })
}

describe("comparing suburbs", () => {
  beforeAll(loadLazyChunks, WARM_UP_TIMEOUT_MS)

  beforeEach(() => {
    mockFetch()
    signOut()
  })

  afterEach(() => {
    cleanup()
  })

  it("picks the second suburb from the map", async () => {
    const { search } = await renderRoute("/?suburb=1")

    await userEvent.click(
      await screen.findByRole("button", { name: "Compare" }),
    )
    expect(screen.getByRole("status")).toHaveTextContent(
      "Pick a suburb to compare with Alpha",
    )
    fireEvent.click(suburb("Beta"))

    await waitFor(() => {
      expect(search()).toStrictEqual({ suburb: "1", compare: "2" })
    })
    await expect(
      screen.findByRole("region", { name: "Alpha and Beta" }),
    ).resolves.toBeInTheDocument()
  })

  it("shows both suburbs' stats side by side", async () => {
    await renderRoute("/?suburb=1&compare=2")

    const panel = await screen.findByRole("region", { name: "Alpha and Beta" })

    const rent = await within(panel).findByRole("button", {
      name: "Show Median rent on the map",
    })

    const row = rent.closest("div")

    expect(row).toHaveTextContent("$650/wk")
    expect(row).toHaveTextContent("–")
    // Census figures Beta lacks still show, as the area both have does.
    expect(within(panel).getByText("0.42 km²")).toBeInTheDocument()
  })

  it("outlines the second suburb on the map", async () => {
    await renderRoute("/?suburb=1&compare=2")

    await screen.findByRole("region", { name: "Alpha and Beta" })

    expect(document.querySelector(".stroke-map-compare")).not.toBeNull()
  })

  it("swaps the two suburbs", async () => {
    const { search } = await renderRoute("/?suburb=1&compare=2")

    await userEvent.click(await screen.findByRole("button", { name: "Swap" }))

    await waitFor(() => {
      expect(search()).toStrictEqual({ suburb: "2", compare: "1" })
    })
  })

  it("goes back to one suburb with Escape, then closes", async () => {
    const { search } = await renderRoute("/?suburb=1&compare=2")

    await screen.findByRole("region", { name: "Alpha and Beta" })
    await userEvent.keyboard("{Escape}")
    await waitFor(() => {
      expect(search()).toStrictEqual({ suburb: "1" })
    })

    await userEvent.keyboard("{Escape}")
    await waitFor(() => {
      expect(search()).toStrictEqual({})
    })
  })

  it("cancels picking with Escape, keeping the suburb", async () => {
    const { search } = await renderRoute("/?suburb=1")

    await userEvent.click(
      await screen.findByRole("button", { name: "Compare" }),
    )
    await userEvent.keyboard("{Escape}")

    await expect(
      screen.findByRole("button", { name: "Compare" }),
    ).resolves.toBeInTheDocument()
    expect(search()).toStrictEqual({ suburb: "1" })
  })

  it("closes both suburbs with the close button", async () => {
    const { search } = await renderRoute("/?suburb=1&compare=2")

    await userEvent.click(await screen.findByRole("button", { name: "Close" }))

    await waitFor(() => {
      expect(search()).toStrictEqual({})
    })
  })

  it("ignores a comparison with itself", async () => {
    await renderRoute("/?suburb=1&compare=1")

    await expect(
      screen.findByRole("region", { name: "Alpha" }),
    ).resolves.toBeInTheDocument()
  })
})

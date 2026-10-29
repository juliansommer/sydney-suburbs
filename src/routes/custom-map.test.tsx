import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@solidjs/testing-library"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { STORAGE_KEY } from "@/lib/regions"
import { signOut } from "@/test/auth"
import { mockFetch } from "@/test/mock-fetch"
import { renderRoute, WARM_UP_TIMEOUT_MS, warmUpMap } from "@/test/utils"

// base-ui-solid is transformed from source, which takes seconds cold.
async function loadLazyChunks() {
  await Promise.all([
    import("@/components/regions/regions-panel"),
    import("@/components/map/suburb-search"),
    import("@/lib/region-layers"),
  ])
  await warmUpMap()
}

function fillOf(key: string) {
  return document.querySelector(`[data-layer="${key}"]`)
}

function suburb(name: string) {
  return screen.getByRole("button", { name })
}

function savedRegions() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as {
    regions?: { id: string; name: string; suburbIds: string[] }[]
  }

  return saved.regions ?? []
}

describe("custom map", () => {
  beforeAll(loadLazyChunks, WARM_UP_TIMEOUT_MS)

  beforeEach(() => {
    localStorage.clear()
    mockFetch()
    signOut()
  })

  afterEach(() => {
    cleanup()
  })

  it("is a mode beside the others", async () => {
    const { search } = await renderRoute("/?suburb=1")

    await userEvent.click(
      await screen.findByRole("button", { name: "Custom map" }),
    )

    await waitFor(() => {
      expect(search()).toStrictEqual({ mode: "custom" })
    })
    await expect(
      screen.findByRole("region", { name: "Custom map" }),
    ).resolves.toBeInTheDocument()
  })

  it("starts a region in the first colour with the first click", async () => {
    const { search } = await renderRoute("/?mode=custom")

    await screen.findByRole("region", { name: "Custom map" })
    // Straight after each other, before the first click has drawn.
    fireEvent.click(suburb("Alpha"))
    fireEvent.click(suburb("Beta"))

    await waitFor(() => {
      expect(savedRegions()).toMatchObject([
        { name: "Region 1", color: "#e6194b", suburbIds: ["1", "2"] },
      ])
    })

    const [region] = savedRegions()
    await waitFor(() => {
      expect(search()).toStrictEqual({ mode: "custom", region: region?.id })
    })
    await waitFor(() => {
      expect(fillOf(region?.id ?? "")).toHaveStyle({ "--region": "#e6194b" })
    })
  })

  it("adds to the region picked in the list", async () => {
    await renderRoute("/?mode=custom")

    await screen.findByRole("region", { name: "Custom map" })
    fireEvent.click(suburb("Alpha"))
    await userEvent.click(screen.getByRole("button", { name: "New region" }))

    // The new region's name is focused, to type over.
    const name = await screen.findByRole("textbox", { name: "Region name" })
    await waitFor(() => {
      expect(name).toHaveFocus()
    })
    expect(name).toHaveValue("Region 2")
    await userEvent.clear(name)
    await userEvent.type(name, "Beach")

    fireEvent.click(suburb("Gamma"))
    await waitFor(() => {
      expect(savedRegions()).toMatchObject([
        { name: "Region 1", suburbIds: ["1"] },
        { name: "Beach", color: "#3cb44b", suburbIds: ["3"] },
      ])
    })

    await userEvent.click(
      screen.getByRole("button", { name: "Add to Region 1" }),
    )
    fireEvent.click(suburb("Gamma"))
    await waitFor(() => {
      expect(savedRegions()).toMatchObject([
        { suburbIds: ["1", "3"] },
        { suburbIds: [] },
      ])
    })
  })

  it("takes a suburb out when clicked again", async () => {
    await renderRoute("/?mode=custom")

    await screen.findByRole("region", { name: "Custom map" })
    fireEvent.click(suburb("Alpha"))
    await waitFor(() => {
      expect(savedRegions()[0]?.suburbIds).toStrictEqual(["1"])
    })

    fireEvent.click(suburb("Alpha"))
    await waitFor(() => {
      expect(savedRegions()[0]?.suburbIds).toStrictEqual([])
    })
  })

  it("lets a region's colour be changed", async () => {
    await renderRoute("/?mode=custom")

    await userEvent.click(
      await screen.findByRole("button", { name: "New region" }),
    )
    await userEvent.click(
      await screen.findByRole("button", { name: "Colour for Region 1" }),
    )
    await userEvent.click(
      await screen.findByRole("button", { name: "#4363d8" }),
    )

    await waitFor(() => {
      expect(savedRegions()).toMatchObject([{ color: "#4363d8" }])
    })
  })

  it("adds every suburb in a council", async () => {
    await renderRoute("/?mode=custom")

    await userEvent.click(
      await screen.findByRole("combobox", { name: "Add a council" }),
    )
    await userEvent.click(
      await screen.findByRole("option", { name: /Sydney/u }),
    )

    await waitFor(() => {
      expect(savedRegions()[0]?.suburbIds).toStrictEqual(["1", "2", "3"])
    })
  })

  it("keeps the regions across a remount", async () => {
    await renderRoute("/?mode=custom")

    await screen.findByRole("region", { name: "Custom map" })
    fireEvent.click(suburb("Beta"))
    await waitFor(() => {
      expect(savedRegions()).toHaveLength(1)
    })
    cleanup()

    await renderRoute("/?mode=custom")

    const list = await screen.findByRole("list", { name: "Regions" })
    expect(
      within(list).getByRole("textbox", { name: "Region name" }),
    ).toHaveValue("Region 1")
  })

  it("adds to the newest region when the link's is unknown", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        title: "Mine",
        regions: [
          { id: "a", name: "Old", color: "#e6194b", suburbIds: [] },
          { id: "b", name: "New", color: "#3cb44b", suburbIds: [] },
        ],
      }),
    )
    await renderRoute("/?mode=custom&region=nope")

    await expect(
      screen.findByRole("textbox", { name: "Region name" }),
    ).resolves.toHaveValue("New")
    fireEvent.click(suburb("Alpha"))

    await waitFor(() => {
      expect(savedRegions()[1]?.suburbIds).toStrictEqual(["1"])
    })
  })

  it("opens no suburb panel on click", async () => {
    const { search } = await renderRoute("/?mode=custom")

    await screen.findByRole("region", { name: "Custom map" })
    fireEvent.click(suburb("Alpha"))

    await waitFor(() => {
      expect(savedRegions()).toHaveLength(1)
    })
    expect(search()).not.toHaveProperty("suburb")
    expect(screen.queryByRole("region", { name: "Alpha" })).toBeNull()
  })

  it("names the suburb and its region on hover", async () => {
    await renderRoute("/?mode=custom")

    await screen.findByRole("region", { name: "Custom map" })
    fireEvent.click(suburb("Alpha"))
    await waitFor(() => {
      expect(savedRegions()).toHaveLength(1)
    })
    fireEvent.pointerMove(suburb("Alpha"), { pointerType: "mouse" })

    await expect(screen.findByRole("tooltip")).resolves.toHaveTextContent(
      "Alpha · Region 1",
    )
  })
})

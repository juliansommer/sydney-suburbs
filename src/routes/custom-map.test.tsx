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

async function createRegion(name: string) {
  await userEvent.type(
    await screen.findByRole("textbox", { name: "Region name" }),
    name,
  )
  await userEvent.click(screen.getByRole("button", { name: "Create" }))
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

  it("names the selected suburbs as a region in the next colour", async () => {
    const { search } = await renderRoute("/?mode=custom")

    await screen.findByRole("region", { name: "Custom map" })
    // Straight after each other, before the first click has drawn.
    fireEvent.click(suburb("Alpha"))
    fireEvent.click(suburb("Beta"))

    await expect(
      screen.findByText("2 suburbs selected"),
    ).resolves.toBeInTheDocument()
    await createRegion("Harbour")

    const list = await screen.findByRole("list", { name: "Regions" })
    expect(within(list).getByText("Harbour")).toBeInTheDocument()
    expect(savedRegions()).toMatchObject([
      { name: "Harbour", color: "#e6194b", suburbIds: ["1", "2"] },
    ])

    const [region] = savedRegions()
    await waitFor(() => {
      expect(search()).toStrictEqual({ mode: "custom", region: region?.id })
    })
    expect(fillOf(region?.id ?? "")).toHaveStyle({ "--region": "#e6194b" })
  })

  it("lets the default colour be changed before creating", async () => {
    await renderRoute("/?mode=custom")

    await screen.findByRole("region", { name: "Custom map" })
    fireEvent.click(suburb("Alpha"))
    await userEvent.click(
      await screen.findByRole("button", { name: "Colour for the new region" }),
    )
    await userEvent.click(
      await screen.findByRole("button", { name: "#4363d8" }),
    )
    await createRegion("Blue")

    expect(savedRegions()).toMatchObject([{ name: "Blue", color: "#4363d8" }])
  })

  it("toggles suburbs in the region being edited", async () => {
    await renderRoute("/?mode=custom")

    await screen.findByRole("region", { name: "Custom map" })
    fireEvent.click(suburb("Alpha"))
    await createRegion("Harbour")
    await screen.findByText(/Click suburbs to add them/u)

    fireEvent.click(suburb("Gamma"))
    await waitFor(() => {
      expect(savedRegions()[0]?.suburbIds).toStrictEqual(["1", "3"])
    })

    fireEvent.click(suburb("Alpha"))
    await waitFor(() => {
      expect(savedRegions()[0]?.suburbIds).toStrictEqual(["3"])
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

    await expect(
      screen.findByText("3 suburbs selected"),
    ).resolves.toBeInTheDocument()
  })

  it("keeps the regions across a remount", async () => {
    await renderRoute("/?mode=custom")

    await screen.findByRole("region", { name: "Custom map" })
    fireEvent.click(suburb("Beta"))
    await createRegion("Kept")
    cleanup()

    await renderRoute("/?mode=custom")

    const list = await screen.findByRole("list", { name: "Regions" })
    expect(within(list).getByText("Kept")).toBeInTheDocument()
  })

  it("treats an unknown region in the link as none", async () => {
    await renderRoute("/?mode=custom&region=nope")

    await screen.findByRole("region", { name: "Custom map" })
    fireEvent.click(suburb("Alpha"))

    await expect(
      screen.findByText("1 suburb selected"),
    ).resolves.toBeInTheDocument()
  })

  it("opens no suburb panel on click", async () => {
    const { search } = await renderRoute("/?mode=custom")

    await screen.findByRole("region", { name: "Custom map" })
    fireEvent.click(suburb("Alpha"))

    await screen.findByText("1 suburb selected")
    expect(search()).not.toHaveProperty("suburb")
    expect(screen.queryByRole("region", { name: "Alpha" })).toBeNull()
  })
})

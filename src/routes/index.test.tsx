import { setTimeout as sleep } from "node:timers/promises"

import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@solidjs/testing-library"
import userEvent from "@testing-library/user-event"
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { signOut as signOutRequest } from "@/lib/auth"
import { signIn, signOut } from "@/test/auth"
import { isFactsRequest, mockFetch } from "@/test/mock-fetch"
import { renderRoute } from "@/test/utils"
import type { UserSuburb } from "@/types/user-suburb"

vi.mock(import("@/lib/auth"), async (importOriginal) => ({
  ...(await importOriginal()),
  signOut: vi.fn(),
}))

// base-ui-solid is transformed from source, which takes seconds cold, longer
// than a findBy waits, so the lazy chunks load up front.
const WARM_UP_TIMEOUT_MS = 30_000
async function loadLazyChunks() {
  await Promise.all([
    import("@/routes/index"),
    import("@/components/suburb-panel"),
    import("@/components/map/suburb-search"),
    import("@/components/council-progress"),
    import("@/components/birthplace-legend"),
    import("@/components/nrl-legend"),
  ])
}

function visitedRow(suburbId: string): UserSuburb {
  return {
    suburbId,
    visited: true,
    visitedOn: null,
    notes: "",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
}

function visitedFill() {
  return document.querySelector('[data-layer="visited"]')
}

describe("map page", () => {
  beforeAll(loadLazyChunks, WARM_UP_TIMEOUT_MS)

  beforeEach(() => {
    mockFetch()
    signOut()
  })

  it("shows the map to everyone", async () => {
    await renderRoute("/")

    await expect(
      screen.findByRole("button", { name: "Alpha" }),
    ).resolves.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith("/sydney-suburbs.topo.json")
  })

  it("links to the login page when signed out", async () => {
    await renderRoute("/")

    await expect(
      screen.findByRole("link", { name: "Sign in" }),
    ).resolves.toHaveAttribute("href", "/login")
  })

  it("signs out to the map", async () => {
    signIn()
    const assign = vi.spyOn(window.location, "assign").mockReturnValue()

    await renderRoute("/?suburb=1")

    await userEvent.click(
      await screen.findByRole("button", { name: "Sign out" }),
    )

    expect(signOutRequest).toHaveBeenCalledWith()
    expect(assign).toHaveBeenCalledWith("/")
    assign.mockRestore()
  })

  it("reloads even when signing out fails", async () => {
    signIn()
    vi.mocked(signOutRequest).mockRejectedValueOnce(new Error("500"))
    const assign = vi.spyOn(window.location, "assign").mockReturnValue()

    await renderRoute("/")

    await userEvent.click(
      await screen.findByRole("button", { name: "Sign out" }),
    )

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith("/")
    })
    assign.mockRestore()
  })

  it("counts visited suburbs in the header", async () => {
    signIn()
    mockFetch({ suburbs: [visitedRow("1"), visitedRow("2")] })

    await renderRoute("/")

    await expect(
      screen.findByRole("button", { name: "2 of 3 suburbs visited" }),
    ).resolves.toBeInTheDocument()
  })

  it("shows NRL territories instead of visits in NRL mode", async () => {
    signIn()
    mockFetch({ suburbs: [visitedRow("1")] })

    await renderRoute("/?mode=nrl")

    await expect(
      screen.findByText(/Not affiliated with or endorsed by the NRL/u),
    ).resolves.toBeInTheDocument()
    await waitFor(() => {
      expect(document.querySelector('[data-layer="roosters"]')).not.toBeNull()
    })
    expect(visitedFill()).toBeNull()
    expect(
      screen.queryByRole("button", { name: /suburbs visited/u }),
    ).not.toBeInTheDocument()
  })

  it("shows each suburb's top overseas birthplace in birthplace mode", async () => {
    await renderRoute("/?mode=birthplace")

    const key = await screen.findByRole("list", { name: "Birthplace key" })
    expect(key).toHaveTextContent("England")
    expect(key).toHaveTextContent("No data")
    await waitFor(() => {
      expect(
        document.querySelector('[data-layer="country-england"] path'),
      ).toHaveAttribute(
        "d",
        screen.getByRole("button", { name: "Alpha" }).getAttribute("d"),
      )
    })
    expect(
      document.querySelector('[data-layer="country-england"]'),
    ).toHaveAttribute("fill", expect.stringMatching(/^url\(#/u))
  })

  it("toggles the birthplace map from the suburb panel", async () => {
    const { search } = await renderRoute("/?suburb=1")

    await userEvent.click(
      await screen.findByRole("button", { name: "More details" }),
    )
    const button = screen.getByRole("button", { name: "Show birthplace map" })
    await userEvent.click(button)

    await waitFor(() => {
      expect(search()).toStrictEqual({
        suburb: "1",
        mode: "birthplace",
      })
    })

    await userEvent.click(button)

    await waitFor(() => {
      expect(search()).toStrictEqual({ suburb: "1" })
    })
  })

  it("shows a heatmap of household income by default", async () => {
    signIn()
    mockFetch({ suburbs: [visitedRow("1")] })

    await renderRoute("/?mode=heatmap")

    await expect(
      screen.findByRole("combobox", { name: "Statistic" }),
    ).resolves.toHaveValue("medianHouseholdIncome")
    const key = await screen.findByRole("list", {
      name: "Household income key",
    })
    await waitFor(() => {
      expect(key).toHaveTextContent("$2,000 – $2,500/wk")
    })
    expect(key).toHaveTextContent("No data")
    expect(document.querySelector('[data-layer="heat-3"]')).toHaveAttribute(
      "d",
      screen.getByRole("button", { name: "Alpha" }).getAttribute("d"),
    )
    expect(visitedFill()).toBeNull()
    expect(
      screen.queryByRole("button", { name: /suburbs visited/u }),
    ).not.toBeInTheDocument()
  })

  it("switches the heatmap's stat from the key", async () => {
    const { search } = await renderRoute("/?mode=heatmap")

    await userEvent.selectOptions(
      await screen.findByRole("combobox", { name: "Statistic" }),
      "Violent crime",
    )

    await waitFor(() => {
      expect(search()).toStrictEqual({
        mode: "heatmap",
        stat: "violentCrimeRate",
      })
    })
    await expect(
      screen.findByRole("list", { name: "Violent crime key" }),
    ).resolves.toHaveTextContent("1,000 – 2,500 per 100k")
  })

  it("shows a stat's heatmap from the suburb panel", async () => {
    const { search } = await renderRoute("/?suburb=1")

    await userEvent.click(
      await screen.findByRole("button", { name: "More details" }),
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Show Median rent heatmap" }),
    )

    await waitFor(() => {
      expect(search()).toStrictEqual({
        suburb: "1",
        mode: "heatmap",
        stat: "medianRent",
      })
    })
    await expect(
      screen.findByRole("list", { name: "Median rent key" }),
    ).resolves.toBeInTheDocument()
  })

  it("hides the heatmap when its stat is clicked again", async () => {
    const { search } = await renderRoute(
      "/?suburb=1&mode=heatmap&stat=medianRent",
    )

    await userEvent.click(
      await screen.findByRole("button", { name: "More details" }),
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Show Median rent heatmap" }),
    )

    await waitFor(() => {
      expect(search()).toStrictEqual({ suburb: "1" })
    })
  })

  it("keeps the selected suburb when switching mode", async () => {
    const { search } = await renderRoute("/?suburb=1")

    await userEvent.click(await screen.findByRole("button", { name: "NRL" }))

    await waitFor(() => {
      expect(search()).toStrictEqual({
        suburb: "1",
        mode: "nrl",
      })
    })
  })

  it("selects a suburb on click and shows its panel", async () => {
    const { search } = await renderRoute("/")

    // A bare click: happy-dom lacks the SVG geometry d3-zoom's mousedown needs.
    fireEvent.click(await screen.findByRole("button", { name: "Alpha" }))

    const panel = await screen.findByRole("region", { name: "Alpha" })
    await waitFor(() => {
      expect(search()).toHaveProperty("suburb", "1")
    })
    expect(within(panel).getByText("Sydney Council")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })

  it("asks signed-out users to sign in and come back", async () => {
    await renderRoute("/?suburb=1")

    const link = await screen.findByRole("link", {
      name: "Sign in to track your visits",
    })
    const href = new URL(link.getAttribute("href") ?? "", "http://localhost")
    expect(href.pathname).toBe("/login")
    expect(href.searchParams.get("redirect")).toBe("/?suburb=1")
  })

  it("marks a suburb visited before the request finishes", async () => {
    signIn()
    let responded = false
    mockFetch({
      onPatch: async () => {
        await sleep(500)
        responded = true
        return Response.json(visitedRow("1"))
      },
    })
    await renderRoute("/?suburb=1")

    await userEvent.click(
      await screen.findByRole("button", { name: "Mark Visited" }),
    )

    await expect(
      screen.findByRole("button", { name: "Visited ✓" }),
    ).resolves.toBeVisible()
    expect(visitedFill()).toHaveAttribute(
      "d",
      screen.getByRole("button", { name: "Alpha" }).getAttribute("d"),
    )
    expect(responded).toBeFalsy()
  })

  it("rolls back when marking visited fails", async () => {
    signIn()
    mockFetch({
      onPatch: () => Response.json({ error: "boom" }, { status: 500 }),
    })
    await renderRoute("/?suburb=1")

    await userEvent.click(
      await screen.findByRole("button", { name: "Mark Visited" }),
    )

    await expect(screen.findByRole("alert")).resolves.toHaveTextContent(
      "Couldn’t save that",
    )
    expect(screen.getByRole("button", { name: "Mark Visited" })).toBeVisible()
    expect(visitedFill()).toBeNull()
  })

  it("opens the panel for the suburb in the URL", async () => {
    await renderRoute("/?suburb=2")

    await expect(
      screen.findByRole("region", { name: "Beta" }),
    ).resolves.toBeInTheDocument()
  })

  it.each(["999", "abc"])("ignores a suburb id of %s", async (id) => {
    await renderRoute(`/?suburb=${id}`)

    await screen.findByRole("button", { name: "Alpha" })
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
  })

  it("closes the panel on Escape", async () => {
    const { search } = await renderRoute("/?suburb=1")
    await screen.findByRole("region", { name: "Alpha" })

    await userEvent.keyboard("{Escape}")

    await waitFor(() => {
      expect(screen.queryByRole("region")).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(search()).not.toHaveProperty("suburb")
    })
  })

  it("closes the panel from its close button", async () => {
    await renderRoute("/?suburb=1")

    await userEvent.click(await screen.findByRole("button", { name: "Close" }))

    expect(screen.queryByRole("region")).not.toBeInTheDocument()
  })

  it("closes the panel when its suburb is clicked again", async () => {
    const { search } = await renderRoute("/?suburb=1")
    await screen.findByRole("region", { name: "Alpha" })

    fireEvent.click(screen.getByRole("button", { name: "Alpha" }))

    await waitFor(() => {
      expect(screen.queryByRole("region")).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(search()).not.toHaveProperty("suburb")
    })
  })
})

function factsRequests() {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([input]) =>
      isFactsRequest(input instanceof Request ? input.url : input.toString()),
    )
}

describe("map page suburb facts", () => {
  beforeAll(loadLazyChunks, WARM_UP_TIMEOUT_MS)

  // Idle callbacks are held here, so each test decides when the browser is idle.
  let idleCallbacks: (() => void)[] = []

  beforeEach(() => {
    mockFetch()
    signOut()
    idleCallbacks = []
    vi.stubGlobal("requestIdleCallback", (callback: () => void) => {
      idleCallbacks.push(callback)
      return idleCallbacks.length
    })
    vi.stubGlobal("cancelIdleCallback", () => {})
  })

  // Unmount first, so the page's cleanup still finds the stubs.
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("waits for the map, then fetches facts when the browser is idle", async () => {
    await renderRoute("/")

    await screen.findByRole("button", { name: "Alpha" })
    expect(factsRequests()).toHaveLength(0)

    for (const callback of idleCallbacks) {
      callback()
    }

    await waitFor(() => {
      expect(factsRequests()).toHaveLength(1)
    })
  })

  it("fetches facts straight away for a suburb link", async () => {
    await renderRoute("/?suburb=1")

    await expect(
      screen.findByRole("img", { name: "Alpha" }),
    ).resolves.toBeInTheDocument()
    expect(factsRequests()).toHaveLength(1)
  })
})

import { createRouter, memoryHistory } from "@solidjs/router"
import { render, screen, waitFor } from "@solidjs/testing-library"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Overlay } from "@/lib/stats"
import { createMySuburbs, MySuburbsContext } from "@/queries/my-suburbs"
import { signIn, signOut } from "@/test/auth"
import { mockFetch } from "@/test/mock-fetch"

import { SuburbPanel } from "./suburb-panel"

const alpha = { id: "1", name: "Alpha", lga: "Sydney" }
const beta = { id: "2", name: "Beta", lga: "Inner West" }

interface RenderPanelOptions {
  suburb?: typeof alpha
  signedIn?: boolean
  onZoomToCouncil?: (lga: string) => void
  overlay?: Overlay
  onToggleOverlay?: (overlay: Overlay) => void
}

// Queries read the router, and the visit form reads the user's rows, so the
// panel renders inside both.
function renderPanel({
  suburb = alpha,
  signedIn = true,
  onZoomToCouncil = () => {},
  overlay,
  onToggleOverlay = () => {},
}: RenderPanelOptions = {}) {
  if (signedIn) {
    signIn()
  } else {
    signOut()
  }
  const Router = createRouter({
    routes: [
      {
        path: "/",
        component: () => (
          <MySuburbsContext value={createMySuburbs(() => signedIn)}>
            <SuburbPanel
              onClose={() => {}}
              onToggleOverlay={onToggleOverlay}
              onZoomToCouncil={onZoomToCouncil}
              overlay={overlay}
              signedIn={signedIn}
              suburb={suburb}
            />
          </MySuburbsContext>
        ),
      },
    ],
    history: memoryHistory("/"),
  })
  return render(() => <Router>{(props) => props.children}</Router>)
}

describe("SuburbPanel notes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("saves once, after typing stops", async () => {
    const { patches } = mockFetch()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPanel()

    await user.type(await screen.findByRole("textbox"), "Good pies")
    expect(patches).toStrictEqual([])
    expect(screen.getByText("Saving…")).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(600)

    expect(patches).toStrictEqual([
      ["/api/me/suburbs/1", { notes: "Good pies" }],
    ])
    await expect(screen.findByText("Saved")).resolves.toBeInTheDocument()
  })

  it("saves unsaved notes when it closes", async () => {
    const { patches } = mockFetch()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { unmount } = renderPanel()

    await user.type(await screen.findByRole("textbox"), "Ferry")
    unmount()

    await waitFor(() => {
      expect(patches).toStrictEqual([["/api/me/suburbs/1", { notes: "Ferry" }]])
    })
  })
})

describe("SuburbPanel council", () => {
  it("zooms to the council when its name is clicked", async () => {
    mockFetch()
    const onZoomToCouncil = vi.fn<(lga: string) => void>()
    const user = userEvent.setup()
    renderPanel({ onZoomToCouncil })

    await user.click(
      await screen.findByRole("button", { name: "Sydney Council" }),
    )

    expect(onZoomToCouncil).toHaveBeenCalledWith("Sydney")
  })
})

describe("SuburbPanel facts", () => {
  it("shows census details when expanded", async () => {
    mockFetch()
    const user = userEvent.setup()
    renderPanel()

    await user.click(
      await screen.findByRole("button", { name: "More details" }),
    )

    const details = [
      ["Median age", "34"],
      ["Born overseas", "31%"],
      ["Median rent", "$650/wk"],
      ["Household income", "$2,450/wk"],
      ["Housing commission", "4.2%"],
      ["Violent crime", "1,350 per 100k"],
      ["Tree canopy", "24.6%"],
      ["Top birthplace", "England · 6.7%"],
      ["Area", "2.1 km²"],
      ["Density", "7,286/km²"],
    ]
    for (const [label, value] of details) {
      expect(screen.getByText(label ?? "").closest("div")).toHaveTextContent(
        value ?? "",
      )
    }
  })

  it("shows a stat's heatmap when it's clicked", async () => {
    mockFetch()
    const onToggleOverlay = vi.fn<(overlay: Overlay) => void>()
    const user = userEvent.setup()
    renderPanel({ onToggleOverlay })

    await user.click(
      await screen.findByRole("button", { name: "More details" }),
    )
    await user.click(
      screen.getByRole("button", { name: "Show Violent crime heatmap" }),
    )

    expect(onToggleOverlay).toHaveBeenCalledWith("violentCrimeRate")
    expect(
      screen.queryByRole("button", { name: "Show Area heatmap" }),
    ).not.toBeInTheDocument()
  })

  it("shows the birthplace map when the top birthplace is clicked", async () => {
    mockFetch()
    const onToggleOverlay = vi.fn<(overlay: Overlay) => void>()
    const user = userEvent.setup()
    renderPanel({ onToggleOverlay })

    await user.click(
      await screen.findByRole("button", { name: "More details" }),
    )
    await user.click(
      screen.getByRole("button", { name: "Show birthplace map" }),
    )

    expect(onToggleOverlay).toHaveBeenCalledWith("birthplace")
  })

  it("marks the stat the map is showing", async () => {
    mockFetch()
    const user = userEvent.setup()
    renderPanel({ overlay: "medianRent" })

    await user.click(
      await screen.findByRole("button", { name: "More details" }),
    )

    expect(
      screen.getByRole("button", { name: "Show Median rent heatmap" }),
    ).toHaveAttribute("aria-pressed", "true")
    expect(
      screen.getByRole("button", { name: "Show Median age heatmap" }),
    ).toHaveAttribute("aria-pressed", "false")
  })

  it("skips census details the ABS didn't publish", async () => {
    mockFetch()
    const user = userEvent.setup()
    renderPanel({ suburb: beta })

    await user.click(
      await screen.findByRole("button", { name: "More details" }),
    )

    expect(screen.getByText("0.42 km²")).toBeVisible()
    expect(screen.queryByText("Median age")).not.toBeInTheDocument()
    expect(screen.queryByText("Density")).not.toBeInTheDocument()
    expect(screen.queryByText("Violent crime")).not.toBeInTheDocument()
  })

  it("shows the photo, facts and summary", async () => {
    mockFetch()
    renderPanel()

    const photo = await screen.findByRole("img", { name: "Alpha" })
    expect(photo).toHaveAttribute(
      "src",
      "https://example.public.blob.vercel-storage.com/suburbs/1-abcd1234.webp",
    )
    expect(photo).toHaveAttribute("width", "800")
    expect(photo).toHaveAttribute("height", "533")
    expect(screen.getByText("Postcode 2042 · 15,301 people")).toBeVisible()
    expect(
      screen.getByText(
        "A harbourside suburb of the Inner West, known for its parks.",
      ),
    ).toBeVisible()
    expect(screen.getByText("Sydney Council")).toBeVisible()
  })

  it("credits the photo from its info button", async () => {
    mockFetch()
    const user = userEvent.setup()
    renderPanel()

    await user.click(
      await screen.findByRole("button", { name: "Photo credit" }),
    )

    await expect(screen.findByText("Jane Smith")).resolves.toBeVisible()
    expect(screen.getByRole("link", { name: "CC BY-SA 4.0" })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by-sa/4.0",
    )
    expect(
      screen.getByRole("link", { name: "Wikimedia Commons" }),
    ).toHaveAttribute(
      "href",
      "https://commons.wikimedia.org/wiki/File:Alpha.jpg",
    )
  })

  it("leaves out the photo, summary and a population of zero", async () => {
    mockFetch()
    renderPanel({ suburb: beta })

    await expect(screen.findByText("Postcode 2000")).resolves.toBeVisible()
    expect(screen.getByText("Inner West Council")).toBeVisible()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Photo credit" }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/people/)).not.toBeInTheDocument()
  })

  it("shows a skeleton while the facts load", async () => {
    // A response that never arrives keeps the facts loading.
    // oxlint-disable-next-line promise/avoid-new
    mockFetch({ facts: new Promise<Response>(() => {}) })
    renderPanel()

    await expect(
      screen.findByTestId("photo-skeleton"),
    ).resolves.toBeInTheDocument()
    expect(screen.getByTestId("facts-skeleton")).toBeInTheDocument()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("keeps the visit controls when the facts fail to load", async () => {
    mockFetch({ facts: new Response(null, { status: 500 }) })
    renderPanel()

    await waitFor(() => {
      expect(screen.queryByTestId("photo-skeleton")).not.toBeInTheDocument()
    })
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    await expect(
      screen.findByRole("button", { name: "Mark Visited" }),
    ).resolves.toBeVisible()
  })

  it("shows facts to signed-out users too", async () => {
    mockFetch()
    renderPanel({ signedIn: false })

    await expect(
      screen.findByRole("img", { name: "Alpha" }),
    ).resolves.toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Sign in to track your visits" }),
    ).toBeVisible()
  })
})

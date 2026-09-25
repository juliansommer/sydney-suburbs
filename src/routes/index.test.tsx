import { setTimeout as sleep } from "node:timers/promises"

import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { authClient } from "@/lib/auth-client"
import { mockFetch } from "@/test/mock-fetch"
import { renderRoute } from "@/test/utils"
import type { UserSuburb } from "@/types/user-suburb"

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: vi.fn(),
    signIn: { social: vi.fn() },
    signOut: vi.fn(),
  },
}))

const useSession = vi.mocked(authClient.useSession)

function signIn() {
  useSession.mockReturnValue({
    data: { user: { email: "someone@example.com" } },
    isPending: false,
  } as ReturnType<typeof authClient.useSession>)
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
  return document.querySelector(".fill-map-visited")
}

describe("map page", () => {
  beforeEach(() => {
    mockFetch()
    useSession.mockReturnValue({
      data: null,
      isPending: false,
    } as ReturnType<typeof authClient.useSession>)
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

  it("shows the signed-in user and signs out", async () => {
    signIn()

    await renderRoute("/")

    await expect(
      screen.findByText("someone@example.com"),
    ).resolves.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }))

    expect(authClient.signOut).toHaveBeenCalledWith()
  })

  it("counts visited suburbs in the header", async () => {
    signIn()
    mockFetch({ suburbs: [visitedRow("1"), visitedRow("2")] })

    await renderRoute("/")

    await expect(
      screen.findByText("2 / 3 suburbs"),
    ).resolves.toBeInTheDocument()
  })

  it("selects a suburb on click and shows its panel", async () => {
    const { router } = await renderRoute("/")

    // A bare click: happy-dom lacks the SVG geometry d3-zoom's mousedown needs.
    fireEvent.click(await screen.findByRole("button", { name: "Alpha" }))

    const panel = await screen.findByRole("region", { name: "Alpha" })
    expect(router.state.location.search).toHaveProperty("suburb", 1)
    expect(within(panel).getByText("Sydney")).toBeInTheDocument()
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
      await screen.findByRole("button", { name: "Mark visited" }),
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
      await screen.findByRole("button", { name: "Mark visited" }),
    )

    await expect(screen.findByRole("alert")).resolves.toHaveTextContent(
      "Couldn’t save that",
    )
    expect(screen.getByRole("button", { name: "Mark visited" })).toBeVisible()
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
    const { router } = await renderRoute("/?suburb=1")
    await screen.findByRole("region", { name: "Alpha" })

    await userEvent.keyboard("{Escape}")

    await waitFor(() => {
      expect(screen.queryByRole("region")).not.toBeInTheDocument()
    })
    expect(router.state.location.search).not.toHaveProperty("suburb")
  })

  it("closes the panel from its close button", async () => {
    await renderRoute("/?suburb=1")

    await userEvent.click(await screen.findByRole("button", { name: "Close" }))

    expect(screen.queryByRole("region")).not.toBeInTheDocument()
  })
})

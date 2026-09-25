import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { authClient } from "@/lib/auth-client"
import { suburbsTopology } from "@/test/fixtures"
import { renderRoute } from "@/test/utils"

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: vi.fn(),
    signIn: { social: vi.fn() },
    signOut: vi.fn(),
  },
}))

const useSession = vi.mocked(authClient.useSession)

describe("map page", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(suburbsTopology)),
    )
    useSession.mockReturnValue({
      data: null,
      isPending: false,
    } as ReturnType<typeof authClient.useSession>)
  })

  it("shows the map to everyone", async () => {
    await renderRoute("/")

    await expect(screen.findByLabelText("Alpha")).resolves.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith("/sydney-suburbs.topo.json")
  })

  it("links to the login page when signed out", async () => {
    await renderRoute("/")

    await expect(
      screen.findByRole("link", { name: "Sign in" }),
    ).resolves.toHaveAttribute("href", "/login")
  })

  it("shows the signed-in user and signs out", async () => {
    useSession.mockReturnValue({
      data: { user: { email: "someone@example.com" } },
      isPending: false,
    } as ReturnType<typeof authClient.useSession>)

    await renderRoute("/")

    await expect(
      screen.findByText("someone@example.com"),
    ).resolves.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }))

    expect(authClient.signOut).toHaveBeenCalledWith()
  })
})

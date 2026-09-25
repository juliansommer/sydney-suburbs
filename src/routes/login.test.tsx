import { screen, waitFor } from "@testing-library/react"
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

describe("login page", () => {
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

  it("offers Google sign-in", async () => {
    await renderRoute("/login")

    await userEvent.click(
      await screen.findByRole("button", { name: "Sign in with Google" }),
    )

    expect(authClient.signIn.social).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/",
    })
  })

  it("sends signed-in users to the map", async () => {
    useSession.mockReturnValue({
      data: { user: { email: "someone@example.com" } },
      isPending: false,
    } as ReturnType<typeof authClient.useSession>)

    const { router } = await renderRoute("/login")

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/")
    })
  })

  it("returns to where sign-in started", async () => {
    await renderRoute(`/login?redirect=${encodeURIComponent("/?suburb=2")}`)

    await userEvent.click(
      await screen.findByRole("button", { name: "Sign in with Google" }),
    )

    expect(authClient.signIn.social).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/?suburb=2",
    })
  })

  it("sends signed-in users back to the redirect", async () => {
    useSession.mockReturnValue({
      data: { user: { email: "someone@example.com" } },
      isPending: false,
    } as ReturnType<typeof authClient.useSession>)

    const { router } = await renderRoute(
      `/login?redirect=${encodeURIComponent("/?suburb=2")}`,
    )

    await waitFor(() => {
      expect(router.state.location.search).toHaveProperty("suburb", 2)
    })
  })

  it.each(["//evil.com", String.raw`/\evil.com`, "https://evil.com"])(
    "ignores an off-site redirect (%s)",
    async (redirect) => {
      await renderRoute(`/login?redirect=${encodeURIComponent(redirect)}`)

      await userEvent.click(
        await screen.findByRole("button", { name: "Sign in with Google" }),
      )

      expect(authClient.signIn.social).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/",
      })
    },
  )
})

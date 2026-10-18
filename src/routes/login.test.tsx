import { screen, waitFor } from "@solidjs/testing-library"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { signInWith } from "@/lib/auth"
import { signIn, signOut } from "@/test/auth"
import { mockFetch } from "@/test/mock-fetch"
import { renderRoute } from "@/test/utils"

vi.mock(import("@/lib/auth"), async (importOriginal) => ({
  ...(await importOriginal()),
  signInWith: vi.fn(),
}))

describe("login page", () => {
  beforeEach(() => {
    mockFetch()
    signOut()
  })

  it("offers Google sign-in", async () => {
    await renderRoute("/login")

    await userEvent.click(
      await screen.findByRole("button", { name: "Sign in with Google" }),
    )

    expect(signInWith).toHaveBeenCalledWith("google", "/")
  })

  it("offers GitHub sign-in", async () => {
    await renderRoute("/login")

    await userEvent.click(
      await screen.findByRole("button", { name: "Sign in with GitHub" }),
    )

    expect(signInWith).toHaveBeenCalledWith("github", "/")
  })

  it("sends signed-in users to the map", async () => {
    signIn()

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

    expect(signInWith).toHaveBeenCalledWith("google", "/?suburb=2")
  })

  it("sends signed-in users back to the redirect", async () => {
    signIn()

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

      expect(signInWith).toHaveBeenCalledWith("google", "/")
    },
  )
})

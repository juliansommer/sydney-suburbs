import { screen, waitFor } from "@solidjs/testing-library"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { signInWith } from "@/lib/auth"
import { signIn, signOut } from "@/test/auth"
import { mockFetch } from "@/test/mock-fetch"
import { renderRoute } from "@/test/utils"

vi.mock(import("@/lib/auth"), async (importOriginal) => ({
  ...(await importOriginal()),
  signInWith: vi.fn(),
}))

// A redirect lands once the map page's chunk loads, which takes seconds cold,
// longer than a waitFor waits, so it loads up front.
const WARM_UP_TIMEOUT_MS = 30_000

describe("login page", () => {
  beforeAll(async () => {
    await import("@/routes/index")
  }, WARM_UP_TIMEOUT_MS)

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

  it("says so when sign-in can't start", async () => {
    vi.mocked(signInWith).mockRejectedValueOnce(new Error("500"))
    await renderRoute("/login")

    await userEvent.click(
      await screen.findByRole("button", { name: "Sign in with Google" }),
    )

    await expect(screen.findByRole("alert")).resolves.toHaveTextContent(
      "Couldn’t start sign-in. Try again.",
    )
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

    const { pathname } = await renderRoute("/login")

    await waitFor(() => {
      expect(pathname()).toBe("/")
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

    const { search } = await renderRoute(
      `/login?redirect=${encodeURIComponent("/?suburb=2")}`,
    )

    await waitFor(() => {
      expect(search()).toHaveProperty("suburb", "2")
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

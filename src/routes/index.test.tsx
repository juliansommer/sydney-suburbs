import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { authClient } from "@/lib/auth-client"
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
    useSession.mockReturnValue({
      data: null,
      isPending: false,
    } as ReturnType<typeof authClient.useSession>)
  })

  it("offers Google sign-in when signed out", async () => {
    await renderRoute("/")

    await userEvent.click(
      await screen.findByRole("button", { name: "Sign in with Google" }),
    )

    expect(authClient.signIn.social).toHaveBeenCalledWith({
      provider: "google",
    })
  })

  it("shows the signed-in user", async () => {
    useSession.mockReturnValue({
      data: { user: { email: "someone@example.com" } },
      isPending: false,
    } as ReturnType<typeof authClient.useSession>)

    await renderRoute("/")

    await expect(
      screen.findByText("Signed in as someone@example.com"),
    ).resolves.toBeInTheDocument()
  })
})

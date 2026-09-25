import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { mockFetch } from "@/test/mock-fetch"

import { SuburbPanel } from "./suburb-panel"

const suburb = { id: "1", name: "Alpha", lga: "Sydney" }

// The panel links to /login, so it needs a router around it.
async function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(["me", "suburbs"], [])
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <SuburbPanel
          onClose={() => {}}
          rows={new Map()}
          signedIn
          suburb={suburb}
        />
      ),
    }),
    history: createMemoryHistory(),
  })
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  await act(async () => {
    await router.load()
  })
  return result
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
    await renderPanel()

    await user.type(screen.getByRole("textbox"), "Good pies")
    expect(patches).toStrictEqual([])
    expect(screen.getByText("Saving…")).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(patches).toStrictEqual([
      ["/api/me/suburbs/1", { notes: "Good pies" }],
    ])
    await expect(screen.findByText("Saved")).resolves.toBeInTheDocument()
  })

  it("saves unsaved notes when it closes", async () => {
    const { patches } = mockFetch()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { unmount } = await renderPanel()

    await user.type(screen.getByRole("textbox"), "Ferry")
    unmount()

    await waitFor(() => {
      expect(patches).toStrictEqual([["/api/me/suburbs/1", { notes: "Ferry" }]])
    })
  })
})

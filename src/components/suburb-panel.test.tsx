import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { mockFetch } from "@/test/mock-fetch"

import { SuburbPanel } from "./suburb-panel"

const alpha = { id: "1", name: "Alpha", lga: "Sydney" }
const beta = { id: "2", name: "Beta", lga: "Inner West" }

interface RenderPanelOptions {
  suburb?: typeof alpha
  signedIn?: boolean
}

// The panel links to /login, so it needs a router around it.
async function renderPanel({
  suburb = alpha,
  signedIn = true,
}: RenderPanelOptions = {}) {
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
          signedIn={signedIn}
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

describe("SuburbPanel facts", () => {
  it("shows the photo, facts, summary and credits", async () => {
    mockFetch()
    await renderPanel()

    const photo = await screen.findByRole("img", { name: "Alpha" })
    expect(photo).toHaveAttribute(
      "src",
      "https://example.public.blob.vercel-storage.com/suburbs/1-abcd1234.webp",
    )
    expect(photo).toHaveAttribute("width", "800")
    expect(photo).toHaveAttribute("height", "533")
    expect(screen.getByText("Postcode 2042 · 15,301 people")).toBeVisible()
    expect(screen.getByText("Alpha is a suburb of Sydney.")).toBeVisible()
    expect(
      screen.getByRole("link", { name: "Read more on Wikipedia" }),
    ).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Alpha")
    expect(screen.getByText(/Summary from Wikipedia/)).toBeVisible()

    const credit = within(screen.getByRole("figure"))
    expect(credit.getByRole("link", { name: "Jane Smith" })).toHaveAttribute(
      "href",
      "https://commons.wikimedia.org/wiki/File:Alpha.jpg",
    )
    expect(credit.getByRole("link", { name: "CC BY-SA 4.0" })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by-sa/4.0",
    )
  })

  it("shows a placeholder when there's no photo, and no summary", async () => {
    mockFetch()
    await renderPanel({ suburb: beta })

    await expect(screen.findByText("Postcode 2000")).resolves.toBeVisible()
    // The council shows in the header and again in the placeholder.
    expect(screen.getAllByText("Inner West")).toHaveLength(2)
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Read more on Wikipedia" }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Summary from Wikipedia/)).not.toBeInTheDocument()
  })

  it("leaves out a population of zero", async () => {
    mockFetch()
    await renderPanel({ suburb: beta })

    await expect(screen.findByText("Postcode 2000")).resolves.toBeVisible()
    expect(screen.queryByText(/people/)).not.toBeInTheDocument()
  })

  it("shows a skeleton while the facts load", async () => {
    // A response that never arrives keeps the facts loading.
    // oxlint-disable-next-line promise/avoid-new
    mockFetch({ facts: new Promise<Response>(() => {}) })
    await renderPanel()

    expect(screen.getByTestId("photo-skeleton")).toBeInTheDocument()
    expect(screen.getByTestId("facts-skeleton")).toBeInTheDocument()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("keeps the visit controls when the facts fail to load", async () => {
    mockFetch({ facts: new Response(null, { status: 500 }) })
    await renderPanel()

    await waitFor(() => {
      expect(screen.queryByTestId("photo-skeleton")).not.toBeInTheDocument()
    })
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Mark visited" })).toBeVisible()
  })

  it("shows facts to signed-out users too", async () => {
    mockFetch()
    await renderPanel({ signedIn: false })

    await expect(
      screen.findByRole("img", { name: "Alpha" }),
    ).resolves.toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Sign in to track your visits" }),
    ).toBeVisible()
  })
})

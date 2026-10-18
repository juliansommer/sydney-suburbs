import { memoryHistory } from "@solidjs/router"
import { cleanup, render, screen } from "@solidjs/testing-library"

import { AppShell, createAppRouter } from "@/router"

import { signOut } from "./auth"
import { mockFetch } from "./mock-fetch"

// Cold, the map page and its panel take seconds to transform, longer than a
// findBy waits.
export const WARM_UP_TIMEOUT_MS = 30_000

// Renders the real routes at `path`, in memory. `pathname` and `search` read
// where the app has navigated to since.
export function renderRoute(path: string) {
  const history = memoryHistory(path)
  const Router = createAppRouter(history)

  const result = render(() => (
    <Router>{(props) => <AppShell>{props.children}</AppShell>}</Router>
  ))

  const url = () => new URL(history.get(), "http://localhost")

  return {
    ...result,
    pathname: () => url().pathname,
    search: () => Object.fromEntries(url().searchParams),
  }
}

// The router loads each page under its own `?pick=` module id, so importing
// the page file does not warm what a test renders. Rendering it once does.
export async function warmUpMap() {
  mockFetch()
  signOut()
  renderRoute("/?suburb=1")

  await screen.findByRole(
    "img",
    { name: "Alpha" },
    { timeout: WARM_UP_TIMEOUT_MS },
  )
  cleanup()
}

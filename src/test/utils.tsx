import { memoryHistory } from "@solidjs/router"
import { render } from "@solidjs/testing-library"

import { AppShell, createAppRouter } from "@/router"

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

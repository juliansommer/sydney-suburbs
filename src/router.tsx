import {
  createRouter,
  intentPreload,
  type RouterHistory,
} from "@solidjs/router"
import { fileRoutes } from "@solidjs/router/fs"
import type { JSX } from "@solidjs/web"
import { Loading } from "solid-js"
import { pageRoutes } from "virtual:file-routes"

// Routes come from the files in src/routes. Tests pass a memory history.
export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routes: fileRoutes(pageRoutes),
    history,
    // Hovering a link loads the page's chunk before the click.
    preloadLinks: intentPreload(),
  })
}

interface AppShellProps {
  children?: JSX.Element
}

// Wraps every page, and stays mounted across navigations. Pages load in their
// own chunks, so the first one fills in once it arrives.
export function AppShell(props: AppShellProps) {
  return (
    <div class="min-h-screen bg-background text-foreground">
      <Loading>{props.children}</Loading>
    </div>
  )
}

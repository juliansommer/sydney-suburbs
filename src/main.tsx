import { render } from "@solidjs/web"
import { QueryClientProvider } from "@tanstack/solid-query"
import { RouterProvider } from "@tanstack/solid-router"

import { createAppRouter } from "@/router"

import "@/styles.css"

const rootElement = document.querySelector("#root")

if (!rootElement) {
  throw new Error("#root missing from index.html")
}

const { router, queryClient } = createAppRouter()

render(
  () => (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  ),
  rootElement,
)

import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { createAppRouter } from "@/router"

import "@/styles.css"

const rootElement = document.querySelector("#root")

if (!rootElement) {
  throw new Error("#root missing from index.html")
}

const { router, queryClient } = createAppRouter()

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)

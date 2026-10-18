import { render } from "@solidjs/web"

import { AppShell, createAppRouter } from "@/router"

import "@/styles.css"

const rootElement = document.querySelector("#root")

if (!rootElement) {
  throw new Error("#root missing from index.html")
}

const Router = createAppRouter()

render(
  () => <Router>{(props) => <AppShell>{props.children}</AppShell>}</Router>,
  rootElement,
)

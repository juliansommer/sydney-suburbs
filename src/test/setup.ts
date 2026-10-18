import "@testing-library/jest-dom/vitest"
import { query } from "@solidjs/router"
import { beforeEach, vi } from "vitest"

import { clearOnce } from "@/lib/load"

// happy-dom has no layout, so report a fixed size as soon as an element is
// observed.
class FixedResizeObserver {
  readonly #callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback
  }

  observe(target: Element) {
    const entry = { target, contentRect: { width: 800, height: 600 } }
    this.#callback([entry as ResizeObserverEntry], this)
  }

  unobserve() {}

  disconnect() {}
}

vi.stubGlobal("ResizeObserver", FixedResizeObserver)

// Cached loads would otherwise carry one test's data into the next.
beforeEach(() => {
  query.clear()
  clearOnce()
})

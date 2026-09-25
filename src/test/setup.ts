import { cleanup } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import { afterEach, vi } from "vitest"

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

afterEach(() => {
  cleanup()
})

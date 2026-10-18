import { type Accessor, createSignal, onSettled } from "solid-js"

interface Size {
  width: number
  height: number
}

// Tracks an element's content size. Returns a ref callback; the size is null
// until the first measurement.
export function useElementSize(): [
  (element: Element) => void,
  Accessor<Size | null>,
] {
  const [size, setSize] = createSignal<Size | null>(null, {
    // A new object for the same size would re-project the whole map.
    equals: (a, b) => a?.width === b?.width && a?.height === b?.height,
  })

  let observer: ResizeObserver | undefined

  const ref = (element: Element) => {
    observer?.disconnect()
    observer = new ResizeObserver(([entry]) => {
      if (entry) {
        const { width, height } = entry.contentRect
        setSize({ width, height })
      }
    })
    observer.observe(element)
  }

  onSettled(() => () => observer?.disconnect())

  return [ref, size]
}

import { useState } from "react"

interface Size {
  width: number
  height: number
}

// Tracks an element's content size. Returns a callback ref; the size is null
// until the first measurement.
export function useElementSize() {
  const [size, setSize] = useState<Size | null>(null)
  const ref = (element: Element | null) => {
    if (!element) {
      return undefined
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        const { width, height } = entry.contentRect
        // A new object for the same size would re-project the whole map.
        setSize((prev) =>
          prev?.width === width && prev.height === height
            ? prev
            : { width, height },
        )
      }
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }
  return [ref, size] as const
}

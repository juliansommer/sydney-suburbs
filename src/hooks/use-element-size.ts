import { useCallback, useState } from "react"

interface Size {
  width: number
  height: number
}

// Tracks an element's content size. Returns a callback ref; the size is null
// until the first measurement.
export function useElementSize() {
  const [size, setSize] = useState<Size | null>(null)
  const ref = useCallback((element: Element | null) => {
    if (!element) {
      return undefined
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        const { width, height } = entry.contentRect
        setSize({ width, height })
      }
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [])
  return [ref, size] as const
}

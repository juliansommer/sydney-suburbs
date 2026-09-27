export type Bounds = [[number, number], [number, number]]

export interface ZoomTarget {
  x: number
  y: number
  k: number
}

// Tiny inner-city suburbs would otherwise fill the screen at 40x, and big
// rural ones would barely zoom at all.
export const MIN_FOCUS_ZOOM = 2
export const MAX_FOCUS_ZOOM = 12
const PADDING = 48

// The box around all of `bounds`.
export function mergeBounds(bounds: readonly Bounds[]): Bounds {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [[bx0, by0], [bx1, by1]] of bounds) {
    x0 = Math.min(x0, bx0)
    y0 = Math.min(y0, by0)
    x1 = Math.max(x1, bx1)
    y1 = Math.max(y1, by1)
  }
  return [
    [x0, y0],
    [x1, y1],
  ]
}

// The transform that centres `bounds` in the viewport, fitted with padding and
// clamped to between `minZoom` and the focus maximum.
export function fitBounds(
  [[x0, y0], [x1, y1]]: Bounds,
  width: number,
  height: number,
  minZoom = MIN_FOCUS_ZOOM,
): ZoomTarget {
  const padding = PADDING
  const fit = Math.min(
    (width - 2 * padding) / Math.max(x1 - x0, 1e-6),
    (height - 2 * padding) / Math.max(y1 - y0, 1e-6),
  )
  const k = Math.min(MAX_FOCUS_ZOOM, Math.max(minZoom, fit))
  return {
    x: width / 2 - k * ((x0 + x1) / 2),
    y: height / 2 - k * ((y0 + y1) / 2),
    k,
  }
}

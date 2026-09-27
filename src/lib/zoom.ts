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

// The transform that centres `bounds` in the viewport, fitted with padding and
// clamped to the focus zoom range.
export function fitBounds(
  [[x0, y0], [x1, y1]]: Bounds,
  width: number,
  height: number,
  padding = PADDING,
): ZoomTarget {
  const fit = Math.min(
    (width - 2 * padding) / Math.max(x1 - x0, 1e-6),
    (height - 2 * padding) / Math.max(y1 - y0, 1e-6),
  )
  const k = Math.min(MAX_FOCUS_ZOOM, Math.max(MIN_FOCUS_ZOOM, fit))
  return {
    x: width / 2 - k * ((x0 + x1) / 2),
    y: height / 2 - k * ((y0 + y1) / 2),
    k,
  }
}

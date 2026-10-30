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

// The viewport's right and bottom edges hidden under a panel, in pixels.
export interface Covered {
  right: number
  bottom: number
}

const NOT_COVERED: Covered = { right: 0, bottom: 0 }

// The transform that centres `bounds` in the uncovered part of the viewport,
// fitted with padding and clamped to between `minZoom` and the focus maximum.
export function fitBounds(
  [[x0, y0], [x1, y1]]: Bounds,
  width: number,
  height: number,
  minZoom = MIN_FOCUS_ZOOM,
  covered = NOT_COVERED,
): ZoomTarget {
  const shownWidth = Math.max(width - covered.right, 2 * PADDING + 1)
  const shownHeight = Math.max(height - covered.bottom, 2 * PADDING + 1)

  const fit = Math.min(
    (shownWidth - 2 * PADDING) / Math.max(x1 - x0, 1e-6),
    (shownHeight - 2 * PADDING) / Math.max(y1 - y0, 1e-6),
  )

  const k = Math.min(MAX_FOCUS_ZOOM, Math.max(minZoom, fit))

  return {
    x: shownWidth / 2 - k * ((x0 + x1) / 2),
    y: shownHeight / 2 - k * ((y0 + y1) / 2),
    k,
  }
}

// The smallest box around all of them.
export function unionBounds(all: readonly Bounds[]): Bounds {
  const xs = all.flatMap(([[x0], [x1]]) => [x0, x1])
  const ys = all.flatMap(([[, y0], [, y1]]) => [y0, y1])

  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ]
}

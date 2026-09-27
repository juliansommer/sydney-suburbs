// Rough average glyph width of the UI font, as a fraction of font size.
const CHAR_WIDTH = 0.55
// Breathing room kept between neighbouring labels, in screen pixels.
const LABEL_GAP = 4

interface Box {
  width: number
  height: number
}

// Strategic centres from the Greater Sydney Region Plan, grouped into tiers.
// Earlier tiers claim space first, so the biggest centres win collisions.
const LABEL_TIERS = [
  ["Sydney", "Parramatta"],
  [
    "Bankstown",
    "Blacktown",
    "Bondi Junction",
    "Campbelltown",
    "Chatswood",
    "Hornsby",
    "Liverpool",
    "Macquarie Park",
    "Manly",
    "Mascot",
    "North Sydney",
    "Penrith",
    "Sutherland",
  ],
  [
    "Badgerys Creek",
    "Brookvale",
    "Burwood",
    "Campsie",
    "Castle Hill",
    "Dee Why",
    "Epping",
    "Fairfield",
    "Frenchs Forest",
    "Hurstville",
    "Kogarah",
    "Leppington",
    "Marsden Park",
    "Miranda",
    "Mount Druitt",
    "Narellan",
    "Norwest",
    "Randwick",
    "Rhodes",
    "Rouse Hill",
    "St Leonards",
    "St Marys",
    "Sydney Olympic Park",
    "Westmead",
  ],
] as const

// Zoom factor at which each tier starts showing, indexed like LABEL_TIERS.
const TIER_MIN_ZOOM = [1, 1, 2] as const

const TIER_BY_NAME = new Map<string, number>(
  LABEL_TIERS.flatMap((names, tier) => names.map((name) => [name, tier])),
)

// A label shows once its suburb, scaled by the zoom factor `k`, is wide and
// tall enough to hold the text at `fontSize` screen pixels.
export function labelFits(box: Box, k: number, name: string, fontSize: number) {
  return (
    box.width * k >= name.length * CHAR_WIDTH * fontSize &&
    box.height * k >= fontSize
  )
}

// Major centres show from their tier's zoom regardless of size; everything
// else waits until the name fits inside the suburb.
export function labelVisible(
  suburb: Box & { name: string },
  k: number,
  fontSize: number,
): boolean {
  const tier = TIER_BY_NAME.get(suburb.name)
  const tierShown = tier !== undefined && k >= (TIER_MIN_ZOOM[tier] ?? Infinity)
  return tierShown || labelFits(suburb, k, suburb.name, fontSize)
}

export interface LabelCandidate extends Box {
  name: string
  x: number
  y: number
}

function byPriority(a: LabelCandidate, b: LabelCandidate): number {
  const tierA = TIER_BY_NAME.get(a.name) ?? Infinity
  const tierB = TIER_BY_NAME.get(b.name) ?? Infinity
  if (tierA !== tierB) {
    return tierA - tierB
  }
  return b.width * b.height - a.width * a.height
}

// Places labels centred on (x, y) from highest priority down, dropping any
// that would overlap one already placed.
export function placeLabels<T extends LabelCandidate>(
  candidates: T[],
  fontSize: number,
): T[] {
  const placed: { x0: number; y0: number; x1: number; y1: number }[] = []
  return candidates.toSorted(byPriority).filter((c) => {
    const halfWidth = (c.name.length * CHAR_WIDTH * fontSize + LABEL_GAP) / 2
    const halfHeight = (fontSize + LABEL_GAP) / 2
    const box = {
      x0: c.x - halfWidth,
      y0: c.y - halfHeight,
      x1: c.x + halfWidth,
      y1: c.y + halfHeight,
    }
    const overlaps = placed.some(
      (p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0,
    )
    if (overlaps) {
      return false
    }
    placed.push(box)
    return true
  })
}

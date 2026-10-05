// Sydney NRL club territories, hand-curated from the NSWRL district junior
// league areas. Unofficial: no club or league publishes suburb boundaries.

import type { SuburbProperties } from "@/types/suburb"

// Uploaded by hand to Vercel Blob as `nrl/{club id}.webp`, 128 px square.
const LOGO_BASE = "https://gnedsyjrzrxocto7.public.blob.vercel-storage.com/nrl"

export const CLUB_IDS = [
  "rabbitohs",
  "roosters",
  "dragons",
  "sharks",
  "bulldogs",
  "eels",
  "panthers",
  "wests-tigers",
  "sea-eagles",
] as const

export type ClubId = (typeof CLUB_IDS)[number]

interface Club {
  name: string
  shortName: string
  // Tailwind class for the territory fill. The colours live in styles.css,
  // mixed with the land so they're opaque and cheap to redraw while zooming.
  fill: string
}

export const CLUBS = {
  rabbitohs: {
    name: "South Sydney Rabbitohs",
    shortName: "Rabbitohs",
    fill: "fill-club-rabbitohs",
  },
  roosters: {
    name: "Sydney Roosters",
    shortName: "Roosters",
    fill: "fill-club-roosters",
  },
  dragons: {
    name: "St George Illawarra Dragons",
    shortName: "Dragons",
    fill: "fill-club-dragons",
  },
  sharks: {
    name: "Cronulla-Sutherland Sharks",
    shortName: "Sharks",
    fill: "fill-club-sharks",
  },
  bulldogs: {
    name: "Canterbury-Bankstown Bulldogs",
    shortName: "Bulldogs",
    fill: "fill-club-bulldogs",
  },
  eels: {
    name: "Parramatta Eels",
    shortName: "Eels",
    fill: "fill-club-eels",
  },
  panthers: {
    name: "Penrith Panthers",
    shortName: "Panthers",
    fill: "fill-club-panthers",
  },
  "wests-tigers": {
    name: "Wests Tigers",
    shortName: "Wests Tigers",
    fill: "fill-club-wests-tigers",
  },
  "sea-eagles": {
    name: "Manly Warringah Sea Eagles",
    shortName: "Sea Eagles",
    fill: "fill-club-sea-eagles",
  },
} as const satisfies Record<ClubId, Club>

export function clubLogo(club: ClubId): string {
  return `${LOGO_BASE}/${club}.webp`
}

// Every council on the map, with the club most of it belongs to.
export const LGA_CLUBS = new Map<string, ClubId>(
  Object.entries({
    Bayside: "dragons",
    Blacktown: "panthers",
    Burwood: "wests-tigers",
    Camden: "wests-tigers",
    Campbelltown: "wests-tigers",
    "Canada Bay": "wests-tigers",
    "Canterbury-Bankstown": "bulldogs",
    Cumberland: "eels",
    Fairfield: "eels",
    "Georges River": "dragons",
    Hawkesbury: "panthers",
    Hornsby: "sea-eagles",
    "Hunters Hill": "sea-eagles",
    "Inner West": "wests-tigers",
    "Ku-ring-gai": "sea-eagles",
    "Lane Cove": "sea-eagles",
    Liverpool: "wests-tigers",
    Mosman: "sea-eagles",
    "North Sydney": "sea-eagles",
    "Northern Beaches": "sea-eagles",
    Parramatta: "eels",
    Penrith: "panthers",
    Randwick: "rabbitohs",
    Ryde: "wests-tigers",
    Strathfield: "wests-tigers",
    "Sutherland Shire": "sharks",
    Sydney: "roosters",
    "The Hills Shire": "eels",
    Waverley: "roosters",
    Willoughby: "sea-eagles",
    Woollahra: "roosters",
  }),
)

// Suburbs in split councils that belong to a different club from the
// council default, keyed by suburb name.
export const SUBURB_OVERRIDES = new Map<string, ClubId>(
  Object.entries({
    // Northern Randwick.
    "Centennial Park": "roosters",
    Clovelly: "roosters",
    // Souths' heartland in the City of Sydney.
    Alexandria: "rabbitohs",
    Beaconsfield: "rabbitohs",
    Camperdown: "rabbitohs",
    Darlington: "rabbitohs",
    Erskineville: "rabbitohs",
    Eveleigh: "rabbitohs",
    Redfern: "rabbitohs",
    Rosebery: "rabbitohs",
    Waterloo: "rabbitohs",
    Zetland: "rabbitohs",
    // Botany, in Bayside.
    Banksmeadow: "rabbitohs",
    Botany: "rabbitohs",
    Daceyville: "rabbitohs",
    Eastgardens: "rabbitohs",
    Eastlakes: "rabbitohs",
    Hillsdale: "rabbitohs",
    Mascot: "rabbitohs",
    Pagewood: "rabbitohs",
    // The old Newtown district, in the Inner West.
    "Dulwich Hill": "rabbitohs",
    Enmore: "rabbitohs",
    Lewisham: "rabbitohs",
    Marrickville: "rabbitohs",
    Newtown: "rabbitohs",
    Petersham: "rabbitohs",
    "St Peters": "rabbitohs",
    Stanmore: "rabbitohs",
    Sydenham: "rabbitohs",
    Tempe: "rabbitohs",
    // Epping, which joins on to Ryde.
    Epping: "wests-tigers",
    // Canterbury-Bankstown league clubs in Liverpool council.
    "Chipping Norton": "bulldogs",
    Hammondville: "bulldogs",
    Holsworthy: "bulldogs",
    Moorebank: "bulldogs",
    "Pleasure Point": "bulldogs",
    "Voyager Point": "bulldogs",
    "Wattle Grove": "bulldogs",
    // Liverpool's rural west, next to Penrith.
    "Badgerys Creek": "panthers",
    Greendale: "panthers",
    Luddenham: "panthers",
    Wallacia: "panthers",
    // Hornsby's rural west, next to the Hills.
    Arcadia: "eels",
    Berrilee: "eels",
    Cherrybrook: "eels",
    Dural: "eels",
    Galston: "eels",
  }),
)

export function clubFor({ name, lga }: SuburbProperties): ClubId | undefined {
  return SUBURB_OVERRIDES.get(name) ?? LGA_CLUBS.get(lga)
}

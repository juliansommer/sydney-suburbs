import bangladeshFlag from "./flags/bangladesh.webp"
import chinaFlag from "./flags/china.webp"
import englandFlag from "./flags/england.webp"
import fijiFlag from "./flags/fiji.webp"
import greeceFlag from "./flags/greece.webp"
import indiaFlag from "./flags/india.webp"
import indonesiaFlag from "./flags/indonesia.webp"
import iraqFlag from "./flags/iraq.webp"
import italyFlag from "./flags/italy.webp"
import lebanonFlag from "./flags/lebanon.webp"
import maltaFlag from "./flags/malta.webp"
import nepalFlag from "./flags/nepal.webp"
import newZealandFlag from "./flags/new-zealand.webp"
import northMacedoniaFlag from "./flags/north-macedonia.webp"
import philippinesFlag from "./flags/philippines.webp"
import southAfricaFlag from "./flags/south-africa.webp"
import southKoreaFlag from "./flags/south-korea.webp"
import vietnamFlag from "./flags/vietnam.webp"

export interface CountryColour {
  key: string
  label: string
  // Literal class names, so Tailwind generates them.
  fill: string
  swatch: string
}

export interface Country {
  key: string
  label: string
  flag: string
}

// Every country that tops at least one suburb, most suburbs first.
export const COUNTRIES: readonly Country[] = [
  {
    key: "england",
    label: "England",
    flag: englandFlag,
  },
  {
    key: "china",
    label: "China",
    flag: chinaFlag,
  },
  {
    key: "india",
    label: "India",
    flag: indiaFlag,
  },
  {
    key: "vietnam",
    label: "Vietnam",
    flag: vietnamFlag,
  },
  {
    key: "iraq",
    label: "Iraq",
    flag: iraqFlag,
  },
  {
    key: "philippines",
    label: "Philippines",
    flag: philippinesFlag,
  },
  {
    key: "lebanon",
    label: "Lebanon",
    flag: lebanonFlag,
  },
  {
    key: "italy",
    label: "Italy",
    flag: italyFlag,
  },
  {
    key: "new-zealand",
    label: "New Zealand",
    flag: newZealandFlag,
  },
  {
    key: "greece",
    label: "Greece",
    flag: greeceFlag,
  },
  {
    key: "bangladesh",
    label: "Bangladesh",
    flag: bangladeshFlag,
  },
  {
    key: "malta",
    label: "Malta",
    flag: maltaFlag,
  },
  {
    key: "nepal",
    label: "Nepal",
    flag: nepalFlag,
  },
  {
    key: "fiji",
    label: "Fiji",
    flag: fijiFlag,
  },
  {
    key: "south-africa",
    label: "South Africa",
    flag: southAfricaFlag,
  },
  {
    key: "south-korea",
    label: "South Korea",
    flag: southKoreaFlag,
  },
  {
    key: "north-macedonia",
    label: "North Macedonia",
    flag: northMacedoniaFlag,
  },
  {
    key: "indonesia",
    label: "Indonesia",
    flag: indonesiaFlag,
  },
]

export const OTHER_COUNTRY: CountryColour = {
  key: "other",
  label: "Other",
  fill: "fill-country-other",
  swatch: "bg-country-other",
}

export const NO_BIRTHPLACE: CountryColour = {
  key: "none",
  label: "No data",
  fill: "fill-heat-none",
  swatch: "bg-heat-none",
}

import bangladeshFlag from "flag-icons/flags/4x3/bd.svg"
import chinaFlag from "flag-icons/flags/4x3/cn.svg"
import fijiFlag from "flag-icons/flags/4x3/fj.svg"
import englandFlag from "flag-icons/flags/4x3/gb-eng.svg"
import greeceFlag from "flag-icons/flags/4x3/gr.svg"
import indonesiaFlag from "flag-icons/flags/4x3/id.svg"
import indiaFlag from "flag-icons/flags/4x3/in.svg"
import iraqFlag from "flag-icons/flags/4x3/iq.svg"
import italyFlag from "flag-icons/flags/4x3/it.svg"
import southKoreaFlag from "flag-icons/flags/4x3/kr.svg"
import lebanonFlag from "flag-icons/flags/4x3/lb.svg"
import northMacedoniaFlag from "flag-icons/flags/4x3/mk.svg"
import maltaFlag from "flag-icons/flags/4x3/mt.svg"
import nepalFlag from "flag-icons/flags/4x3/np.svg"
import newZealandFlag from "flag-icons/flags/4x3/nz.svg"
import philippinesFlag from "flag-icons/flags/4x3/ph.svg"
import vietnamFlag from "flag-icons/flags/4x3/vn.svg"
import southAfricaFlag from "flag-icons/flags/4x3/za.svg"

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

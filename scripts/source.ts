// Everything tied to the ASGS edition and Census lives here, so moving to
// Edition 4 (2026) and the 2026 Census is a matter of updating this file.

export const SOURCE = {
  baseUrl:
    "https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files",
  sal: "SAL_2021_AUST_GDA2020_SHP.zip",
  gccsa: "GCCSA_2021_AUST_SHP_GDA2020.zip",
  lga: "LGA_2021_AUST_GDA2020_SHP.zip",
  mb: "MB_2021_AUST_SHP_GDA2020.zip",
  poa: "POA_2021_AUST_GDA2020_SHP.zip",
  fields: {
    state: "STE_CODE21",
    gccsa: "GCC_CODE21",
    salCode: "SAL_CODE21",
    salName: "SAL_NAME21",
    lgaName: "LGA_NAME21",
    mbCategory: "MB_CAT21",
    poaCode: "POA_CODE21",
  },
  nsw: "1",
  greaterSydney: "1GSYD",
} as const

// General Community Profile DataPack for NSW suburbs. Table G01 has total
// persons per suburb, with codes like "SAL10001".
export const CENSUS = {
  url: "https://www.abs.gov.au/census/find-census-data/datapacks/download/2021_GCP_SAL_for_NSW_short-header.zip",
  file: "2021_GCP_SAL_for_NSW_short-header.zip",
  g01: "2021 Census GCP Suburbs and Localities for NSW/2021Census_G01_NSW_SAL.csv",
  fields: {
    salCode: "SAL_CODE_2021",
    totalPersons: "Tot_P_P",
  },
  salPrefix: "SAL",
} as const

export function boundaryUrl(file: string): string {
  return `${SOURCE.baseUrl}/${file}`
}

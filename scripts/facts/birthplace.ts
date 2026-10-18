// The most common overseas country of birth in each suburb, from Census
// tables G09F to G09H.

import type { TopBirthplace } from "../../src/types/suburb-facts.ts"

// The countries G09 counts, by column, with their names. Australia, "born
// elsewhere" and "not stated" are left out.
const COUNTRIES = [
  ["P_Afghanistan_Tot", "Afghanistan"],
  ["P_Bangladesh_Tot", "Bangladesh"],
  ["P_Bosnia_Herzegov_Tot", "Bosnia and Herzegovina"],
  ["P_Brazil_Tot", "Brazil"],
  ["P_Cambodia_Tot", "Cambodia"],
  ["P_Canada_Tot", "Canada"],
  ["P_Chile_Tot", "Chile"],
  ["P_China_Tot", "China"],
  ["P_Croatia_Tot", "Croatia"],
  ["P_Egypt_Tot", "Egypt"],
  ["P_England_Tot", "England"],
  ["P_Fiji_Tot", "Fiji"],
  ["P_France_Tot", "France"],
  ["P_Germany_Tot", "Germany"],
  ["P_Greece_Tot", "Greece"],
  ["P_Hong_Kong_SAR_Ch_Tot", "Hong Kong"],
  ["P_India_Tot", "India"],
  ["P_Indonesia_Tot", "Indonesia"],
  ["P_Iran_Tot", "Iran"],
  ["P_Iraq_Tot", "Iraq"],
  ["P_Ireland_Tot", "Ireland"],
  ["P_Italy_Tot", "Italy"],
  ["P_Japan_Tot", "Japan"],
  ["P_Korea_South_Tot", "South Korea"],
  ["P_Lebanon_Tot", "Lebanon"],
  ["P_Malaysia_Tot", "Malaysia"],
  ["P_Malta_Tot", "Malta"],
  ["P_Mauritius_Tot", "Mauritius"],
  ["P_Myanmar_Tot", "Myanmar"],
  ["P_Nepal_Tot", "Nepal"],
  ["P_Netherlands_Tot", "Netherlands"],
  ["P_New_Zealand_Tot", "New Zealand"],
  ["P_North_Macedonia_Tot", "North Macedonia"],
  ["P_Pakistan_Tot", "Pakistan"],
  ["P_PNG_Tot", "Papua New Guinea"],
  ["P_Philippines_Tot", "Philippines"],
  ["P_Poland_Tot", "Poland"],
  ["P_Samoa_Tot", "Samoa"],
  ["P_Scotland_Tot", "Scotland"],
  ["P_Singapore_Tot", "Singapore"],
  ["P_South_Africa_Tot", "South Africa"],
  ["P_Sri_Lanka_Tot", "Sri Lanka"],
  ["P_Taiwan_Tot", "Taiwan"],
  ["P_Thailand_Tot", "Thailand"],
  ["P_Turkey_Tot", "Turkey"],
  ["P_USA_Tot", "United States"],
  ["P_Vietnam_Tot", "Vietnam"],
  ["P_Wales_Tot", "Wales"],
  ["P_Zimbabwe_Tot", "Zimbabwe"],
] as const

export type CountryColumn = (typeof COUNTRIES)[number][0]

export const COUNTRY_COLUMNS: CountryColumn[] = COUNTRIES.map(
  ([column]) => column,
)

const COUNTRY_NAMES = new Map<string, string>(COUNTRIES)

// Below this, one family can make a country the most common.
export const MIN_POPULATION = 100
const PERCENT = 100
const ONE_DECIMAL = 10

export function topBirthplace(
  counts: Partial<Record<CountryColumn, number>>,
  population: number,
): TopBirthplace | null {
  if (population < MIN_POPULATION) {
    return null
  }

  let column: CountryColumn | null = null
  let count = 0

  for (const c of COUNTRY_COLUMNS) {
    const people = counts[c] ?? 0

    if (people > count) {
      column = c
      count = people
    }
  }

  if (!column) {
    return null
  }

  return {
    country: COUNTRY_NAMES.get(column) ?? column,
    percent:
      Math.round((count / population) * PERCENT * ONE_DECIMAL) / ONE_DECIMAL,
  }
}

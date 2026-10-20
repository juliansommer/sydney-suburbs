# Sydney Suburbs

![Map of Sydney's Suburbs](.github/assets/screenshot1.png)
![Heatmap of Sydney's Suburbs](.github/assets/screenshot2.png)
![Birthplace Map of Sydney's Suburbs](.github/assets/screenshot3.png)
![NRL Map of Sydney's Suburbs](.github/assets/screenshot4.png)

- Interactive map of Greater Sydney's 650 suburbs
- Photo, summary and census stats for each suburb
- Heatmaps for income, rent, crime, tree canopy and more
- NRL club territories
- Visit progress by council
- Sign in with Google or GitHub to sync across devices

## Tech Stack

- **Frontend:** Vite, Solid, TypeScript, Tailwind CSS
- **Map:** SVG drawn with d3-geo and d3-zoom from a TopoJSON file
- **API:** Hono in a Vercel Function
- **Auth:** Better Auth with Google and GitHub sign-in
- **Database:** Neon Postgres with Drizzle ORM
- **Hosting:** Vercel

## Data

Suburb boundaries come from the ABS Australian Statistical Geography Standard (ASGS) Edition 3, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0). The area is the ABS Greater Sydney region minus the Blue Mountains, Central Coast, Oberon and Wollondilly councils, national parks, and the rural fringe. Parks come from ABS Mesh Blocks, and rivers and lakes from NSW Spatial Services Hydro Area. Label priority follows the strategic centres in the NSW Greater Sydney Region Plan.

Suburb facts come from these sources:

- Population, birthplace, top overseas birthplace, medians and housing commission: ABS 2021 Census General Community Profile DataPack, tables G01, G02, G09F to G09H and G37, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0)
- House prices: [NSW Valuer General](https://www.valuergeneral.nsw.gov.au) bulk Property Sales Information, licensed under [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/), as the median price of houses (not units) settled over 12 months, from suburbs with at least 5 sales
- Violent crime: [NSW Bureau of Crime Statistics and Research](https://bocsar.nsw.gov.au) recorded crime by suburb, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0)
- Tree canopy: NSW Department of Planning, Housing and Infrastructure urban tree canopy by suburb 2024/25, © State Government of NSW and NSW Department of Planning, Housing and Infrastructure 2026, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0)
- Area and density: ABS ASGS Edition 3 Suburbs and Localities, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0)
- Postcodes: ABS ASGS Edition 3 Postal Areas, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0), using the postal area that covers most of each suburb
- Matching suburbs to articles and photos: [Wikidata](https://www.wikidata.org), licensed under [CC0](https://creativecommons.org/publicdomain/zero/1.0/)
- Summaries: written for this app, drawing on [Wikipedia](https://en.wikipedia.org) (CC BY-SA 4.0)
- Photos: [Wikimedia Commons](https://commons.wikimedia.org), each under its own free licence; every photo's photographer, licence and source page are listed in `src/data/suburb-facts.json` and on the website

### Updating the data

| Data                  | Current                        | Next update                                                                                  | How                                                                                                                     |
| --------------------- | ------------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Census                | 2021                           | 2026 Census DataPacks, expected mid-2027                                                     | Update `CENSUS` in `scripts/source.ts`, then `pnpm build:facts`                                                         |
| Suburb boundaries     | ASGS Edition 3 (2021)          | Edition 4 came out in October 2026, but it waits for the 2026 Census so both switch together | Update `SOURCE` in `scripts/source.ts` at the same time as the Census, then `pnpm build:suburbs` and `pnpm build:facts` |
| House and land prices | October 2025 to September 2026 | Once a year, when the full 2026 yearly file is published in early 2027                       | Download the yearly and weekly zips into `.cache/psi`, then `pnpm build:house-prices`                                   |
| Violent crime         | July 2025 to June 2026         | BOCSAR adds new months a few times a year                                                    | Delete `.cache/abs/SuburbData.zip`, then `pnpm build:facts`                                                             |
| Tree canopy           | 2024/25                        | Roughly every two to three years (2019, 2022, 2024/25 so far)                                | Update `CANOPY` in `scripts/source.ts`, then `pnpm build:facts`                                                         |
| Photos and summaries  | Ongoing                        | Whenever a suburb gets a better photo                                                        | Edit `scripts/wikipedia-overrides.json`, then `pnpm build:facts`                                                        |

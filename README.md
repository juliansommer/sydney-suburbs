# Sydney Suburbs

Track which Sydney suburbs you've visited.

![Map of Greater Sydney's suburbs](.github/assets/screenshot.png)

- A pannable, zoomable map of Greater Sydney's 648 suburbs, from Penrith to Berowra to Campbelltown
- Click a suburb to select it and mark it visited
- Keep notes and a visit date for each suburb
- See your progress, e.g. "142 / 648 suburbs"
- Sign in with Google to track your visits across devices

## Tech Stack

- **Frontend:** Vite, React, TypeScript, TanStack Router and Query, Tailwind CSS
- **Map:** SVG drawn with d3-geo and d3-zoom from a TopoJSON file
- **API:** Hono in a Vercel Function
- **Auth:** Better Auth with Google sign-in
- **Database:** Neon Postgres with Drizzle ORM
- **Hosting:** Vercel

## Data

Suburb boundaries come from the ABS Australian Statistical Geography Standard (ASGS) Edition 3, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0). The area is the ABS Greater Sydney region minus the Blue Mountains, Central Coast, Oberon and Wollondilly councils, national parks, and the rural fringe. Parks come from ABS Mesh Blocks, and rivers and lakes from NSW Spatial Services Hydro Area. Label priority follows the strategic centres in the NSW Greater Sydney Region Plan.

Suburb facts come from these sources:

- Population: ABS 2021 Census General Community Profile DataPack, table G01, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0)
- Postcodes: ABS ASGS Edition 3 Postal Areas, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0), using the postal area that covers most of each suburb
- Matching suburbs to articles and photos: [Wikidata](https://www.wikidata.org), licensed under [CC0](https://creativecommons.org/publicdomain/zero/1.0/)
- Summaries: [Wikipedia](https://en.wikipedia.org), licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- Photos: [Wikimedia Commons](https://commons.wikimedia.org), each under its own free licence; every photo's photographer, licence and source page are listed in `src/data/suburb-facts.json`

## Rebuilding the data

The map, the suburbs seed migration and the suburb facts are built ahead of time and committed, so the app makes no requests to the ABS or Wikimedia at runtime.

- `pnpm build:suburbs` rebuilds the map and the seed migration from ABS boundaries
- `pnpm build:facts` rebuilds the population, postcode, summary and photo for each suburb, and uploads the photos to Vercel Blob (needs `BLOB_READ_WRITE_TOKEN`)

Downloads are cached in `.cache/`, so reruns are quick. `pnpm build:facts --refresh` ignores cached Wikimedia responses, and `--prune` deletes photos no longer used. The script lists any suburb with no article, summary or photo; fix those in `scripts/wikipedia-overrides.json` and rerun.

# Sydney Suburbs

Track which Sydney suburbs you've visited.

- A pannable, zoomable map of Greater Sydney's 653 suburbs, from Penrith to Berowra to Campbelltown
- Click a suburb to select it, then mark it visited; visited suburbs turn green
- Keep notes and a visit date for each suburb
- See your progress, e.g. "142 / 653 suburbs"
- Anyone can browse the map; sign in with Google to track your visits across devices

## Tech stack

- **Frontend:** Vite, React 19, TypeScript, TanStack Router and Query, Tailwind CSS v4, shadcn/ui (Base UI)
- **Map:** SVG drawn with d3-geo and d3-zoom from a TopoJSON file
- **API:** Hono on a Cloudflare Worker
- **Auth:** Better Auth with Google sign-in
- **Database:** Cloudflare D1 with Drizzle ORM
- **Hosting:** Cloudflare Workers, deployed by GitHub Actions
- **Tooling:** pnpm, Vitest, oxlint and oxfmt (Ultracite)

## Data

Suburb boundaries come from the ABS Australian Statistical Geography Standard (ASGS) Edition 3, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The area is the ABS Greater Sydney region minus the Blue Mountains, Central Coast, Hawkesbury, Oberon and Wollondilly councils. `pnpm build:suburbs` rebuilds the map file and the seed migration.

## Development

```sh
pnpm install
pnpm db:migrate:local
pnpm dev
```

Copy `.env.example` to `.env` and fill in the Google OAuth and Better Auth secrets first.

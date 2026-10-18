import { For } from "solid-js"

import { CLUB_IDS, CLUBS, clubLogo } from "@/data/nrl-territories"

// Club key for the NRL mode, with the note that the territories and logos
// aren't official.
export function NrlLegend() {
  return (
    <div class="flex w-64 flex-col gap-2 rounded-xl border bg-card p-3 text-card-foreground shadow-lg">
      <ul class="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
        <For each={CLUB_IDS}>
          {(club) => (
            <li class="flex items-center gap-1.5">
              <img
                alt=""
                class="size-5"
                height={20}
                src={clubLogo(club)}
                width={20}
              />
              {CLUBS[club].shortName}
            </li>
          )}
        </For>
      </ul>
      <p class="text-xs text-muted-foreground">
        Unofficial. Not affiliated with or endorsed by the NRL or its clubs.
        Logos are trade marks of their owners.
      </p>
    </div>
  )
}

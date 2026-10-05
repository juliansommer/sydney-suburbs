import { CLUB_IDS, CLUBS, clubLogo } from "@/data/nrl-territories"

// Club key for the NRL mode, with the note that the territories and logos
// aren't official.
export function NrlLegend() {
  return (
    <div className="flex w-64 flex-col gap-2 rounded-xl border bg-card p-3 text-card-foreground shadow-lg">
      <ul className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
        {CLUB_IDS.map((club) => (
          <li className="flex items-center gap-1.5" key={club}>
            <img
              alt=""
              className="size-5"
              height={20}
              src={clubLogo(club)}
              width={20}
            />
            {CLUBS[club].shortName}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Unofficial. Not affiliated with or endorsed by the NRL or its clubs.
        Logos are trade marks of their owners.
      </p>
    </div>
  )
}

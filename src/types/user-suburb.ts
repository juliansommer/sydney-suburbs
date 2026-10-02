// A row from /api/me/suburbs. A suburb with no row is unvisited with no notes.
export interface UserSuburb {
  suburbId: string
  visited: boolean
  // YYYY-MM-DD.
  visitedOn: string | null
  notes: string
  updatedAt: string
}

export type UserSuburbPatch = Partial<
  Pick<UserSuburb, "visited" | "visitedOn" | "notes">
>

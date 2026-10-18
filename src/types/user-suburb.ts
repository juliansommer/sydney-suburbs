import { boolean, nullable, object, string, type InferOutput } from "valibot"

// A row from /api/me/suburbs. A suburb with no row is unvisited with no notes.
export const userSuburbSchema = object({
  suburbId: string(),
  visited: boolean(),
  // YYYY-MM-DD.
  visitedOn: nullable(string()),
  notes: string(),
  updatedAt: string(),
})

export type UserSuburb = InferOutput<typeof userSuburbSchema>

export type UserSuburbPatch = Partial<
  Pick<UserSuburb, "visited" | "visitedOn" | "notes">
>

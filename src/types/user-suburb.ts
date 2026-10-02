import { z } from "zod/mini"

// A row from /api/me/suburbs. A suburb with no row is unvisited with no notes.
export const userSuburbSchema = z.object({
  suburbId: z.string(),
  visited: z.boolean(),
  // YYYY-MM-DD.
  visitedOn: z.nullable(z.string()),
  notes: z.string(),
  updatedAt: z.string(),
})

export type UserSuburb = z.infer<typeof userSuburbSchema>

export type UserSuburbPatch = Partial<
  Pick<UserSuburb, "visited" | "visitedOn" | "notes">
>

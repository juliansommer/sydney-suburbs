import { z } from "zod/mini"

// Visits are dated in Sydney time, whatever the Worker's own clock zone.
function sydneyToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
  }).format(new Date())
}

// Every key is optional so overlapping edits (the visited toggle and the notes
// autosave) only write the field they changed.
export const suburbPatchSchema = z
  .strictObject({
    visited: z.optional(z.boolean()),
    visitedOn: z.optional(
      z.nullable(
        z.iso
          .date()
          .check(
            z.refine((date) => date <= sydneyToday(), "date is in the future"),
          ),
      ),
    ),
    notes: z.optional(z.string().check(z.maxLength(10_000))),
  })
  .check(
    z.refine((patch) => Object.keys(patch).length > 0, "nothing to update"),
  )

export type SuburbPatch = z.infer<typeof suburbPatchSchema>

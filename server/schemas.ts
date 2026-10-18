import {
  boolean,
  check,
  type InferOutput,
  isoDate,
  maxLength,
  nullable,
  optional,
  pipe,
  strictObject,
  string,
} from "valibot"

// Visits are dated in Sydney time, whatever the Worker's own clock zone.
const sydneyDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Sydney",
})

function sydneyToday() {
  return sydneyDateFormat.format(new Date())
}

// isoDate only checks the day is 01-31, so a date like Feb 31 is caught by
// round-tripping it through Date, which would roll it into March. The pipe
// still runs this after isoDate fails, so malformed input must not throw.
function isRealDate(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`)

  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date)
  )
}

// Every key is optional so overlapping edits (the visited toggle and the notes
// autosave) only write the field they changed.
export const suburbPatchSchema = pipe(
  strictObject({
    visited: optional(boolean()),
    visitedOn: optional(
      nullable(
        pipe(
          string(),
          isoDate(),
          check(isRealDate, "date does not exist"),
          check((date) => date <= sydneyToday(), "date is in the future"),
        ),
      ),
    ),
    notes: optional(pipe(string(), maxLength(10_000))),
  }),
  check((patch) => Object.keys(patch).length > 0, "nothing to update"),
)

export type SuburbPatch = InferOutput<typeof suburbPatchSchema>

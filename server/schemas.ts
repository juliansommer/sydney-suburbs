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
          check((date) => date <= sydneyToday(), "date is in the future"),
        ),
      ),
    ),
    notes: optional(pipe(string(), maxLength(10_000))),
  }),
  check((patch) => Object.keys(patch).length > 0, "nothing to update"),
)

export type SuburbPatch = InferOutput<typeof suburbPatchSchema>

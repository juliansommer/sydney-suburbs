// Today as YYYY-MM-DD in Sydney, the same "today" the Worker checks visit
// dates against.
export function sydneyToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
  }).format(new Date())
}

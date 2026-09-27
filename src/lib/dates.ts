const sydneyDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Sydney",
})

// Today as YYYY-MM-DD in Sydney, the same "today" the Worker checks visit
// dates against.
export function sydneyToday() {
  return sydneyDateFormat.format(new Date())
}

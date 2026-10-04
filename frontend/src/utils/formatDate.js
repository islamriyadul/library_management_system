// Loan dates come back from the API as full ISO datetimes (e.g.
// "2026-10-11T02:21:49.687782Z") since due_date/issue_date/return_date
// are DateTimeFields on the backend. This turns that into something
// readable like "Oct 11, 2026" wherever a loan date is displayed.
export function formatDate(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Minimal date formatting helpers. We avoid pulling in date-fns to keep
// the bundle small — this tool only needs a handful of formats.

const DAY_NAMES = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const MONTH_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

export function formatDateHeader(d: Date): string {
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

export function formatMonthYear(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatShortDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatDateKeyYMD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// "10 am - 5 pm" or "6:30 - 8 pm"
export function formatEventTimeRange(start: Date, end: Date): string {
  const formatStr = (d: Date) => {
    const hour12 = ((d.getHours() + 11) % 12) + 1;
    const minutes = d.getMinutes();
    return minutes === 0 ? String(hour12) : `${hour12}:${String(minutes).padStart(2, "0")}`;
  };
  const period = (d: Date) => (d.getHours() < 12 ? "am" : "pm");
  const startStr = formatStr(start);
  const endStr = formatStr(end);
  const startPeriod = period(start);
  const endPeriod = period(end);
  if (startPeriod === endPeriod) {
    return `${startStr} - ${endStr} ${endPeriod}`;
  }
  return `${startStr} ${startPeriod} - ${endStr} ${endPeriod}`;
}

export function isValidDate(d: Date): boolean {
  return d instanceof Date && !isNaN(d.getTime());
}

export type DateBucketKey = "earlier" | "today" | "yesterday" | "thisWeek" | string;

const DAY_MS = 86_400_000;

function localCalendarDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

export function dateBucket(
  createdAt: number | undefined,
  now = new Date(),
  locale?: string,
): DateBucketKey {
  if (!createdAt) return "earlier";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "earlier";
  const diffDays = localCalendarDay(now) - localCalendarDay(d);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return "thisWeek";
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Data-age indicator: how fresh is the regulator data the dashboard shows?
 *
 * The radar's value is currency — a compliance team triaging a feed that
 * silently stopped refreshing is worse than no feed at all. `lastScanAt`
 * is the timestamp of the last scan that actually reached at least one
 * regulator source (a scan where every source failed does not advance it —
 * see lib/scan.ts). Anything older than STALE_AFTER_DAYS is stale.
 */

export const STALE_AFTER_DAYS = 7;

export type DataAgeStatus = "current" | "stale" | "unknown";

export interface DataAge {
  status: DataAgeStatus;
  /** Whole days since the last successful scan, or null when unknown. */
  daysOld: number | null;
  lastScanAt: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC calendar-day number — so Nov 18 → Nov 21 reads as 3 days, not 2. */
function dayNumber(d: Date): number {
  return Math.floor(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY_MS,
  );
}

export function getDataAge(
  lastScanAt: string | null | undefined,
  now: Date = new Date(),
): DataAge {
  if (!lastScanAt) return { status: "unknown", daysOld: null, lastScanAt: null };
  const scanned = new Date(lastScanAt);
  if (Number.isNaN(scanned.getTime())) {
    return { status: "unknown", daysOld: null, lastScanAt };
  }
  // Clock skew or a bad timestamp must never read as ancient data.
  const daysOld = Math.max(0, dayNumber(now) - dayNumber(scanned));
  return {
    status: daysOld > STALE_AFTER_DAYS ? "stale" : "current",
    daysOld,
    lastScanAt,
  };
}

/** "today" / "1 day ago" / "N days ago" — null when the age is unknown. */
export function describeDaysOld(daysOld: number | null): string | null {
  if (daysOld === null) return null;
  if (daysOld === 0) return "today";
  if (daysOld === 1) return "1 day ago";
  return `${daysOld} days ago`;
}

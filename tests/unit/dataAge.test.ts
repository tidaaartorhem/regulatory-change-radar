import { describe, expect, it } from "vitest";
import {
  STALE_AFTER_DAYS,
  describeDaysOld,
  getDataAge,
} from "@/lib/dataAge";

// Fixed "now" so the boundary tests never flake with the clock.
const NOW = new Date("2026-11-21T12:00:00.000Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe("getDataAge", () => {
  it("reports the Nov 18 scan as current on Nov 21 (3 days old)", () => {
    const age = getDataAge("2026-11-18T13:49:13.491Z", NOW);
    expect(age.status).toBe("current");
    expect(age.daysOld).toBe(3);
  });

  it("is current at exactly the 7-day threshold", () => {
    const age = getDataAge(daysAgo(STALE_AFTER_DAYS), NOW);
    expect(age.status).toBe("current");
    expect(age.daysOld).toBe(STALE_AFTER_DAYS);
  });

  it("is stale one day past the threshold", () => {
    const age = getDataAge(daysAgo(STALE_AFTER_DAYS + 1), NOW);
    expect(age.status).toBe("stale");
    expect(age.daysOld).toBe(STALE_AFTER_DAYS + 1);
  });

  it("is stale for a month-old scan", () => {
    const age = getDataAge(daysAgo(30), NOW);
    expect(age.status).toBe("stale");
    expect(age.daysOld).toBe(30);
  });

  it("is unknown when no scan has ever run", () => {
    expect(getDataAge(null, NOW)).toEqual({
      status: "unknown",
      daysOld: null,
      lastScanAt: null,
    });
    expect(getDataAge(undefined, NOW).status).toBe("unknown");
  });

  it("is unknown for an unparseable timestamp", () => {
    expect(getDataAge("not-a-date", NOW).status).toBe("unknown");
  });

  it("clamps a future timestamp to 0 days old, never stale", () => {
    const age = getDataAge(
      new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      NOW,
    );
    expect(age.status).toBe("current");
    expect(age.daysOld).toBe(0);
  });
});

describe("describeDaysOld", () => {
  it("reads 0 as today, 1 as singular, N as plural, null as null", () => {
    expect(describeDaysOld(0)).toBe("today");
    expect(describeDaysOld(1)).toBe("1 day ago");
    expect(describeDaysOld(12)).toBe("12 days ago");
    expect(describeDaysOld(null)).toBeNull();
  });
});

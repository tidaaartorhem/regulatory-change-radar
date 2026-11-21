import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataAgeBanner } from "@/components/data-age-banner";

// The banner renders against the real clock, so these fixtures are anchored
// relative to "now" instead of fixed dates.
const daysAgoIso = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

function render(props: Parameters<typeof DataAgeBanner>[0]): string {
  return renderToStaticMarkup(DataAgeBanner(props));
}

describe("DataAgeBanner", () => {
  it("shows the current date and a confirmation for a fresh store", () => {
    const html = render({ lastScanAt: daysAgoIso(3) });
    expect(html).toContain("Data current");
    expect(html).toContain("3 days ago");
    expect(html).not.toContain("days old");
    expect(html).not.toContain("out of date");
  });

  it("warns when the store is stale, with the age in days", () => {
    const html = render({ lastScanAt: daysAgoIso(12) });
    expect(html).toContain("12 days old");
    expect(html).toContain("out of date");
    expect(html).not.toContain("Data current");
  });

  it("says so plainly when no scan has ever run", () => {
    const html = render({ lastScanAt: null });
    expect(html).toContain("No successful scan has run yet");
    expect(html).not.toContain("Data current");
  });

  it("names failed sources from the last scan report", () => {
    const html = render({
      lastScanAt: daysAgoIso(3),
      failedSources: 4,
      totalSources: 17,
    });
    expect(html).toContain("4 of 17 sources failed");
    expect(html).toContain("Data current");
  });

  it("names failed sources on the stale warning too", () => {
    const html = render({
      lastScanAt: daysAgoIso(12),
      failedSources: 4,
      totalSources: 17,
    });
    expect(html).toContain("12 days old");
    expect(html).toContain("4 of 17 sources failed");
  });
});

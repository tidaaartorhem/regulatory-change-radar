import { describe, expect, it, afterEach } from "vitest";
import { fetchSourceItems } from "@/lib/ingest/live";
import type { RegulatorSource } from "@/lib/types";

function htmlOnly(): RegulatorSource {
  return {
    id: "nydfs",
    name: "New York State Department of Financial Services",
    shortName: "NYDFS",
    jurisdiction: "US",
    sectors: ["banking"],
    htmlUrl: "https://www.dfs.ny.gov/reports_and_publications/press_releases",
    feedStatus: "html-fallback",
    pollIntervalHours: 12,
  };
}

describe("fetchSourceItems", () => {
  const prev = process.env.FIRECRAWL_ENABLED;
  afterEach(() => {
    if (prev === undefined) delete process.env.FIRECRAWL_ENABLED;
    else process.env.FIRECRAWL_ENABLED = prev;
  });

  it("routes HTML-only sources to the disabled-adapter error when the flag is off", async () => {
    delete process.env.FIRECRAWL_ENABLED;
    await expect(fetchSourceItems(htmlOnly())).rejects.toThrow(
      /no RSS feed and the Firecrawl scrape adapter is disabled/,
    );
  });

  it("mentions the source in the error so operators know what to enable", async () => {
    delete process.env.FIRECRAWL_ENABLED;
    await expect(fetchSourceItems(htmlOnly())).rejects.toThrow(/NYDFS/);
  });
});

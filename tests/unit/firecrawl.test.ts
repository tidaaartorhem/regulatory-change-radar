import { describe, expect, it, afterEach } from "vitest";
import {
  extractItemsFromScrape,
  firecrawlEnabled,
  scrapeListingPage,
} from "@/lib/ingest/firecrawl";
import type { RegulatorSource } from "@/lib/types";

const PAGE = "https://www.example-regulator.gov/news";

function source(overrides: Partial<RegulatorSource> = {}): RegulatorSource {
  return {
    id: "example",
    name: "Example Regulator",
    shortName: "EX",
    jurisdiction: "US",
    sectors: ["banking"],
    htmlUrl: PAGE,
    feedStatus: "html-fallback",
    pollIntervalHours: 24,
    ...overrides,
  };
}

const MARKDOWN = [
  "# Newsroom",
  "",
  "- [Home](/)",
  "- [OCC issues final rule on operational resilience for large banks](https://www.example-regulator.gov/news/2024/nr-2024-55.html)",
  "- [Contact](/contact)",
  "January 15, 2024 — [Enforcement action announced against First National Bank for risk management failures](https://www.example-regulator.gov/news/2024/nr-2024-56.html)",
  "- [OCC issues final rule on operational resilience for large banks](https://www.example-regulator.gov/news/2024/nr-2024-55.html)",
  "- [Proposed guidance on third-party risk management practices](/news/2024/proposal-12.html)",
].join("\n");

describe("extractItemsFromScrape", () => {
  it("extracts long anchors as publication titles", () => {
    const items = extractItemsFromScrape({ markdown: MARKDOWN }, PAGE);
    expect(items).toHaveLength(3);
    expect(items[0].title).toContain("operational resilience");
    expect(items[0].link).toBe(
      "https://www.example-regulator.gov/news/2024/nr-2024-55.html",
    );
  });

  it("drops nav chrome and short anchors", () => {
    const items = extractItemsFromScrape({ markdown: MARKDOWN }, PAGE);
    const titles = items.map((i) => i.title.toLowerCase());
    expect(titles).not.toContain("home");
    expect(titles).not.toContain("contact");
  });

  it("dedupes repeated links", () => {
    const items = extractItemsFromScrape({ markdown: MARKDOWN }, PAGE);
    const links = items.map((i) => i.link);
    expect(new Set(links).size).toBe(links.length);
  });

  it("resolves relative URLs against the listing page", () => {
    const items = extractItemsFromScrape({ markdown: MARKDOWN }, PAGE);
    const rel = items.find((i) => i.link.endsWith("proposal-12.html"));
    expect(rel?.link).toBe("https://www.example-regulator.gov/news/2024/proposal-12.html");
  });

  it("picks up dates from the surrounding line when present", () => {
    const items = extractItemsFromScrape({ markdown: MARKDOWN }, PAGE);
    const dated = items.find((i) => i.title.startsWith("Enforcement action"));
    expect(dated?.publishedAt.startsWith("2024-01-15")).toBe(true);
  });

  it("returns [] for empty or link-free scrapes", () => {
    expect(extractItemsFromScrape({}, PAGE)).toEqual([]);
    expect(extractItemsFromScrape({ markdown: "# Nothing here" }, PAGE)).toEqual([]);
  });
});

describe("firecrawlEnabled", () => {
  const prev = process.env.FIRECRAWL_ENABLED;
  afterEach(() => {
    if (prev === undefined) delete process.env.FIRECRAWL_ENABLED;
    else process.env.FIRECRAWL_ENABLED = prev;
  });

  it("is off by default", () => {
    delete process.env.FIRECRAWL_ENABLED;
    expect(firecrawlEnabled()).toBe(false);
  });

  it("is on only with the explicit flag", () => {
    process.env.FIRECRAWL_ENABLED = "true";
    expect(firecrawlEnabled()).toBe(true);
    process.env.FIRECRAWL_ENABLED = "1";
    expect(firecrawlEnabled()).toBe(false);
  });
});

describe("scrapeListingPage", () => {
  it("refuses to run when disabled — no network, no key touched", async () => {
    delete process.env.FIRECRAWL_ENABLED;
    await expect(scrapeListingPage(source())).rejects.toThrow(/disabled/);
  });
});

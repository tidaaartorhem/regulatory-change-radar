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

  it("drops image links: markdown images and bare image-file URLs", () => {
    const md = [
      "- ![A man working on a tablet in a home office](https://www.example-regulator.gov/images/2026/04/29/shutterstock_2477030163.jpg?itok=abc)",
      "- [NIST posts guidance on post-quantum cryptography migration plans](https://www.example-regulator.gov/news/2026/pqc-guidance.html)",
      "- [A very long descriptive caption for a chart image file here](https://www.example-regulator.gov/images/chart.png)",
    ].join("\n");
    const items = extractItemsFromScrape({ markdown: md }, PAGE);
    expect(items).toHaveLength(1);
    expect(items[0].link).toContain("pqc-guidance.html");
  });

  it("drops topic/filter listing links, keeps real releases", () => {
    const md = [
      "- [Alternative and Complex Products](https://www.example-regulator.gov/rules-guidance/notices/by-topic?term=31)",
      "- [FINRA reminds firms of their obligations on outside business activities](https://www.example-regulator.gov/rules-guidance/notices/2026-11-10.html)",
    ].join("\n");
    const items = extractItemsFromScrape({ markdown: md }, PAGE);
    expect(items).toHaveLength(1);
    expect(items[0].link).toContain("2026-11-10.html");
  });

  it("drops video, podcast, subscription and homepage side links", () => {
    const md = [
      "- [FDIC Quarterly Banking Profile (2nd Quarter 2024)](https://www.youtube.com/watch?v=rmYRJsKyhNg)",
      "- [Subscribe for email reminders](https://public.govdelivery.com/accounts/USFDIC/subscriber/new?topic_id=USFDIC_22)",
      "- [**Small Business Lending**](https://creators.spotify.com/pod/show/fdic/episodes/Small-Business-Lending-e2t4j)",
      "- [Department of Financial Services](https://www.dfs.ny.gov/)",
      "- [OCC issues a bulletin on third-party risk management practices](https://www.example-regulator.gov/news-issuances/bulletins/2026/bulletin-2026-57.html)",
    ].join("\n");
    const items = extractItemsFromScrape({ markdown: md }, PAGE);
    expect(items).toHaveLength(1);
    expect(items[0].link).toContain("bulletin-2026-57.html");
  });

  it("clamps a future effective date to scrape time instead of trusting it", () => {
    const md =
      "- [Federal Reserve Board announces pricing, effective January 1, 2027, for payment services](https://www.example-regulator.gov/newsevents/pressreleases/other20261112a.htm)";
    const items = extractItemsFromScrape({ markdown: md }, PAGE);
    expect(items).toHaveLength(1);
    expect(items[0].publishedAt.startsWith("2027")).toBe(false);
    expect(items[0].publishedAt.startsWith(new Date().toISOString().slice(0, 10))).toBe(true);
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

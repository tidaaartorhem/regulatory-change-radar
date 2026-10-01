import type { RegulatorSource } from "@/lib/types";
import { fetchFeed, type RawFeedItem } from "@/lib/ingest/rss";
import { firecrawlEnabled, scrapeListingPage } from "@/lib/ingest/firecrawl";

/**
 * Ingestion router — the adapter chain:
 *   1. RSS first (no key needed, cheapest, most reliable)
 *   2. Firecrawl scrape adapter for HTML-only sources (opt-in via
 *      FIRECRAWL_ENABLED; auth delegated to the skill's stored credential)
 *   3. Otherwise: throw, and callers record the source as failed —
 *      the radar never fabricates publications.
 */
export async function fetchSourceItems(
  source: RegulatorSource,
): Promise<RawFeedItem[]> {
  if (source.rssUrl) {
    return fetchFeed(source);
  }
  if (firecrawlEnabled()) {
    return scrapeListingPage(source);
  }
  throw new Error(
    `Source ${source.shortName} has no RSS feed and the Firecrawl scrape adapter is disabled ` +
      `(set FIRECRAWL_ENABLED=true for live HTML scraping).`,
  );
}

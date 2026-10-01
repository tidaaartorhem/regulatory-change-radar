import Parser from "rss-parser";
import type { RegulatorSource } from "@/lib/types";

const parser = new Parser({ timeout: 15000 });

export interface RawFeedItem {
  title: string;
  link: string;
  publishedAt: string; // ISO
  text: string;
}

/**
 * Fetch one regulator's RSS feed. Deterministic downstream: items are sorted
 * by publish date so scans are reproducible. Throws on network/parse failure;
 * callers decide whether to retry or record the outage.
 */
export async function fetchFeed(
  source: RegulatorSource,
): Promise<RawFeedItem[]> {
  if (!source.rssUrl) {
    throw new Error(
      `Source ${source.shortName} has no RSS feed configured (html-fallback)`,
    );
  }
  const feed = await parser.parseURL(source.rssUrl);
  return (feed.items ?? []).map((item) => ({
    title: (item.title ?? "").trim(),
    link: (item.link ?? "").trim(),
    publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
    text: (item.contentSnippet ?? item.content ?? item.summary ?? "").trim(),
  }));
}

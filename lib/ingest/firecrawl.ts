import { execFile } from "child_process";
import { homedir } from "os";
import { join } from "path";
import { promisify } from "util";
import type { RegulatorSource } from "@/lib/types";
import type { RawFeedItem } from "@/lib/ingest/rss";

const execFileAsync = promisify(execFile);
const SCRAPE_TIMEOUT_MS = 90000;

export interface FirecrawlScrapeData {
  markdown?: string;
  links?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Feature gate. Live HTML scraping is opt-in: without FIRECRAWL_ENABLED=true,
 * HTML-only sources are skipped and reported as failed rather than scraped.
 * Auth is NOT handled here — the skill CLI below attaches the stored
 * `custom.firecrawl` credential via its surrogate mechanism, so the app never
 * sees, logs, or persists a raw key.
 */
export function firecrawlEnabled(): boolean {
  return process.env.FIRECRAWL_ENABLED === "true";
}

function skillBinDir(): string {
  return (
    process.env.FIRECRAWL_SKILL_BIN ??
    join(homedir(), "workspace", "skills", "firecrawl", "bin")
  );
}

const JUNK_ANCHORS =
  /^(home|contact|search|menu|skip\W*content|log ?in|sign ?in|subscribe|press releases?|newsroom|news|events|about|careers|site map|privacy|terms)$/i;

function extractDate(line: string): string | null {
  const m =
    line.match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/,
    ) ?? line.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (!m) return null;
  const d = new Date(m[0]);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Pure, testable extraction: turn a Firecrawl scrape of a regulator newsroom
 * listing page into candidate publication items. Parses markdown links,
 * keeps long same-site anchors (real release titles), drops nav chrome,
 * dedupes by URL.
 */
export function extractItemsFromScrape(
  data: FirecrawlScrapeData,
  pageUrl: string,
): RawFeedItem[] {
  const markdown = data.markdown ?? "";
  const seen = new Set<string>();
  const items: RawFeedItem[] = [];
  const linkRe = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

  for (const line of markdown.split("\n")) {
    let m: RegExpExecArray | null;
    // Reset per line to avoid cross-line matches.
    linkRe.lastIndex = 0;
    while ((m = linkRe.exec(line)) !== null) {
      const anchor = m[1].replace(/\s+/g, " ").trim();
      const href = m[2].trim();
      if (anchor.length < 25 || JUNK_ANCHORS.test(anchor)) continue;
      let absolute: string;
      try {
        absolute = new URL(href, pageUrl).toString();
      } catch {
        continue;
      }
      if (!absolute.startsWith("http")) continue;
      if (seen.has(absolute)) continue;
      seen.add(absolute);
      items.push({
        title: anchor,
        link: absolute,
        publishedAt: extractDate(line) ?? new Date().toISOString(),
        text: anchor,
      });
    }
  }
  return items;
}

/**
 * Scrape adapter for HTML-only regulator sources (no RSS feed). Shells out
 * to the Firecrawl skill CLI, which authenticates with the stored
 * `custom.firecrawl` credential — the raw key never crosses into this app.
 * Throws when the adapter is disabled or the skill CLI is unavailable, so
 * callers can record the source as failed.
 */
export async function scrapeListingPage(
  source: RegulatorSource,
): Promise<RawFeedItem[]> {
  if (!firecrawlEnabled()) {
    throw new Error(
      `Firecrawl scrape adapter is disabled for ${source.shortName}: set FIRECRAWL_ENABLED=true to enable live scraping. ` +
        `Demo mode stays fully offline on seeded data.`,
    );
  }
  const bin = join(skillBinDir(), "scrape.py");
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      "python3",
      [bin, source.htmlUrl, "markdown,links"],
      { timeout: SCRAPE_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
    ));
  } catch (e) {
    throw new Error(
      `Firecrawl scrape failed for ${source.shortName}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  let parsed: { data?: FirecrawlScrapeData };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`Firecrawl returned non-JSON output for ${source.shortName}`);
  }
  return extractItemsFromScrape(parsed.data ?? {}, source.htmlUrl);
}

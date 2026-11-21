/**
 * Build-time ingestion: pulls the newest items from every regulator source —
 * RSS where a verified feed exists (keyless), the Firecrawl scrape adapter
 * for HTML-only newsrooms (opt-in via FIRECRAWL_ENABLED=true; auth delegated
 * to the skill's stored credential) — then runs the full radar pipeline
 * (ingest → summarize → map → brief) with the deterministic
 * ExtractiveSummarizer and taxonomy matcher, and writes data/store.json.
 *
 * Idempotent via content-hash dedupe: re-running only adds new items.
 *
 * Loud failures: this script exits NON-ZERO whenever any source errors
 * (see lib/ingest/failures.ts), and the failure is recorded in the store's
 * lastScanReport so the dashboard banner shows it. A scan where every
 * source failed does not advance lastScanAt, so the data-age banner keeps
 * reporting the true age of the data.
 *
 * Build-safe: the `build` npm script tolerates a failed ingest
 * (`npm run data:ingest || true`) — a deploy must never fail because a
 * regulator's newsroom was unreachable, and the radar never fabricates
 * publications to fill a gap. The failure stays loud in the build log and
 * in lastScanReport.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { loadStore, saveStore, type IngestInput } from "@/lib/ingest/store";
import { fetchSourceItems } from "@/lib/ingest/live";
import { ExtractiveSummarizer } from "@/lib/summarize/extractive";
import { getControls } from "@/lib/map/taxonomy";
import { runScan } from "@/lib/scan";
import { formatFailureReport, ingestExitCode } from "@/lib/ingest/failures";
import { buildActionPlan } from "@/lib/brief/briefing";
import type {
  Briefing,
  ControlMapping,
  RegulatorSource,
  ScanSourceResult,
} from "@/lib/types";

const MAX_ITEMS_PER_SOURCE = 15;

function isNetworkFailure(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|timeout|fetch failed|network/i.test(
    msg,
  );
}

async function main(): Promise<void> {
  const dataDir = join(process.cwd(), "data");
  const sources = JSON.parse(
    readFileSync(join(dataDir, "sources.json"), "utf8"),
  ) as RegulatorSource[];
  const controls = getControls();

  const inputs: IngestInput[] = [];
  const results: ScanSourceResult[] = [];

  for (const source of sources) {
    try {
      const items = await fetchSourceItems(source);
      for (const item of items.slice(0, MAX_ITEMS_PER_SOURCE)) {
        inputs.push({
          sourceId: source.id,
          title: item.title,
          link: item.link,
          publishedAt: item.publishedAt,
          text: item.text || item.title,
          jurisdiction: source.jurisdiction,
          sectors: source.sectors,
        });
      }
      results.push({
        source: source.shortName,
        ok: true,
        detail: `+${Math.min(items.length, MAX_ITEMS_PER_SOURCE)} items via ${
          source.rssUrl ? "RSS" : "HTML scrape"
        }`,
      });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      results.push({
        source: source.shortName,
        ok: false,
        detail: detail.slice(0, 200),
      });
    }
  }

  const store = loadStore();
  const okCount = results.filter((r) => r.ok).length;
  const report = await runScan(
    store,
    inputs,
    new ExtractiveSummarizer(),
    controls,
    undefined,
    { sourcesSucceeded: okCount },
  );

  // Backfill action plans for briefings assembled before plans existed.
  for (const briefing of store.briefings as Briefing[]) {
    if (!briefing.actionPlan || briefing.actionPlan.length === 0) {
      const pub = store.publications.find(
        (p) => p.id === briefing.publicationId,
      );
      const mappings = store.mappings.filter(
        (m: ControlMapping) => m.publicationId === briefing.publicationId,
      );
      if (pub) {
        briefing.actionPlan = buildActionPlan(
          pub,
          briefing.severity,
          mappings,
          controls,
          briefing.generatedAt,
        );
      }
    }
  }

  store.lastScanReport = {
    at: report.at,
    added: report.added,
    skipped: report.skipped,
    results,
  };

  // Persist the report even when every source failed — the failure must be
  // visible in the UI, and lastScanAt is left untouched by runScan in that
  // case, so the data-age banner keeps reporting the true age.
  const written = saveStore(store);
  console.log(
    `ingest: ${okCount}/${results.length} sources ok, +${report.added} added, ` +
      `${report.skipped} skipped → ${store.publications.length} publications, ` +
      `${store.mappings.length} mappings, ${store.briefings.length} briefings → ${written}`,
  );
  const exitCode = ingestExitCode(results);
  if (exitCode !== 0) {
    console.error(formatFailureReport(results));
    process.exit(exitCode);
  }
}

main().catch((e) => {
  if (isNetworkFailure(e)) {
    console.warn(
      "ingest: network unavailable — keeping committed store.json, build continues",
    );
    return;
  }
  console.error("ingest failed:", e);
  process.exit(1);
});

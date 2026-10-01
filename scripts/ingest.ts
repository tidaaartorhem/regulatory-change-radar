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
 * Build-safe: if no source is reachable (offline build), the committed
 * store.json is left untouched and the build proceeds (exit 0). A deploy
 * must never fail because a regulator's newsroom was unreachable, and the
 * radar never fabricates publications to fill a gap — failed sources are
 * recorded in the persisted scan report.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { loadStore, saveStore, type IngestInput } from "@/lib/ingest/store";
import { fetchSourceItems } from "@/lib/ingest/live";
import { ExtractiveSummarizer } from "@/lib/summarize/extractive";
import { getControls } from "@/lib/map/taxonomy";
import { runScan } from "@/lib/scan";
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
  const report = await runScan(
    store,
    inputs,
    new ExtractiveSummarizer(),
    controls,
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

  const okCount = results.filter((r) => r.ok).length;
  if (okCount === 0) {
    // Total outage: keep the committed dataset; the build must not fail.
    console.warn(
      "ingest: all sources unreachable — keeping committed store.json, build continues",
    );
    return;
  }

  const written = saveStore(store);
  console.log(
    `ingest: ${okCount}/${results.length} sources ok, +${report.added} added, ` +
      `${report.skipped} skipped → ${store.publications.length} publications, ` +
      `${store.mappings.length} mappings, ${store.briefings.length} briefings → ${written}`,
  );
  for (const r of results.filter((r) => !r.ok)) {
    console.warn(`ingest: FAILED ${r.source}: ${r.detail}`);
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

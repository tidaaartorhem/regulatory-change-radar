/**
 * Build-time seeding: runs the full radar pipeline (ingest → summarize →
 * map → brief) over the seeded demo publications with the deterministic
 * DemoSummarizer, then writes data/store.json. Idempotent — re-running skips
 * already-ingested items via content-hash dedupe, so `next build` on App
 * Hosting is safe to repeat.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { loadStore, saveStore, type IngestInput } from "@/lib/ingest/store";
import { DemoSummarizer } from "@/lib/summarize/demo";
import { getControls } from "@/lib/map/taxonomy";
import { runScan } from "@/lib/scan";
import type { Publication, RegulatorSource } from "@/lib/types";

async function main(): Promise<void> {
  const dataDir = join(process.cwd(), "data");
  const sources = JSON.parse(
    readFileSync(join(dataDir, "sources.json"), "utf8"),
  ) as RegulatorSource[];
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const seeds = JSON.parse(
    readFileSync(join(dataDir, "publications.seed.json"), "utf8"),
  ) as Array<{
    sourceId: string;
    title: string;
    link: string;
    publishedAt: string;
    text: string;
  }>;

  const inputs: IngestInput[] = seeds.map((s) => {
    const source = sourceById.get(s.sourceId);
    if (!source) throw new Error(`Unknown source ${s.sourceId} in seed data`);
    return {
      sourceId: s.sourceId,
      title: s.title,
      link: s.link,
      publishedAt: s.publishedAt,
      text: s.text,
      jurisdiction: source.jurisdiction,
      sectors: source.sectors,
      seeded: true,
    };
  });

  const store = loadStore();
  const report = await runScan(store, inputs, new DemoSummarizer(), getControls());
  const written = saveStore(store);

  const pubs = store.publications as Publication[];
  console.log(
    `seed: +${report.added} added, ${report.skipped} skipped → ${pubs.length} publications, ` +
      `${store.mappings.length} mappings, ${store.briefings.length} briefings → ${written}`,
  );
}

main().catch((e) => {
  console.error("seed failed:", e);
  process.exit(1);
});

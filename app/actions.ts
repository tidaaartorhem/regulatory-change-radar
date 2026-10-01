"use server";

import { revalidatePath } from "next/cache";
import { getSources, getStore, persistStore } from "@/lib/data";
import { getWatchlist, saveWatchlist } from "@/lib/watchlist";
import { fetchSourceItems } from "@/lib/ingest/live";
import { runScan } from "@/lib/scan";
import { DemoSummarizer } from "@/lib/summarize/demo";
import { getControls } from "@/lib/map/taxonomy";
import type { IngestInput } from "@/lib/ingest/store";

export interface ScanActionResult {
  ok: boolean;
  added: number;
  skipped: number;
  /** Per-source fetch notes (failures don't fail the whole scan). */
  notes: string[];
}

export async function runScanAction(): Promise<ScanActionResult> {
  const watchlist = getWatchlist();
  const sources = getSources().filter((s) => watchlist.sources.includes(s.id));
  const notes: string[] = [];
  const inputs: IngestInput[] = [];

  for (const source of sources) {
    try {
      const items = await fetchSourceItems(source);
      for (const item of items.slice(0, 25)) {
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
      notes.push(`${source.shortName}: fetched ${Math.min(items.length, 25)} items`);
    } catch (e) {
      notes.push(
        `${source.shortName}: skipped (${e instanceof Error ? e.message.split(":")[0] : "fetch failed"})`,
      );
    }
  }

  const store = getStore();
  const report = await runScan(store, inputs, new DemoSummarizer(), getControls());
  persistStore();
  revalidatePath("/");
  revalidatePath("/watchlist");
  return { ok: true, added: report.added, skipped: report.skipped, notes };
}

export async function saveWatchlistAction(formData: FormData): Promise<void> {
  const sources = getSources().map((s) => s.id);
  const enabled = sources.filter((id) => formData.get(`src-${id}`) === "on");
  saveWatchlist({ sources: enabled, sectors: ["banking", "insurance", "cyber"] });
  revalidatePath("/watchlist");
}

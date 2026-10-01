"use server";

import { revalidatePath } from "next/cache";
import { getSources, getStore, persistStore } from "@/lib/data";
import { getWatchlist, saveWatchlist } from "@/lib/watchlist";
import { fetchSourceItems } from "@/lib/ingest/live";
import { runScan } from "@/lib/scan";
import { ExtractiveSummarizer } from "@/lib/summarize/extractive";
import { getControls } from "@/lib/map/taxonomy";
import type { IngestInput } from "@/lib/ingest/store";
import type { ScanSourceResult } from "@/lib/types";

export interface ScanActionResult {
  ok: boolean;
  added: number;
  skipped: number;
  /** Per-source fetch results — failures are reported, never hidden. */
  results: ScanSourceResult[];
}

export async function runScanAction(): Promise<ScanActionResult> {
  const watchlist = getWatchlist();
  const sources = getSources().filter((s) => watchlist.sources.includes(s.id));
  const results: ScanSourceResult[] = [];
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
      results.push({
        source: source.shortName,
        ok: true,
        detail: `fetched ${Math.min(items.length, 25)} items`,
      });
    } catch (e) {
      results.push({
        source: source.shortName,
        ok: false,
        detail: e instanceof Error ? e.message.split(":")[0] : "fetch failed",
      });
    }
  }

  const store = getStore();
  const report = await runScan(store, inputs, new ExtractiveSummarizer(), getControls());
  store.lastScanReport = {
    at: new Date().toISOString(),
    added: report.added,
    skipped: report.skipped,
    results,
  };
  persistStore();
  revalidatePath("/");
  revalidatePath("/watchlist");
  return { ok: true, added: report.added, skipped: report.skipped, results };
}

export async function saveWatchlistAction(formData: FormData): Promise<void> {
  const sources = getSources().map((s) => s.id);
  const enabled = sources.filter((id) => formData.get(`src-${id}`) === "on");
  saveWatchlist({ sources: enabled, sectors: ["banking", "insurance", "cyber"] });
  revalidatePath("/watchlist");
}

/**
 * Toggle an action-plan step's completion. Steps are trackable: checked
 * state persists in the store alongside the briefing.
 */
export async function toggleActionStepAction(
  publicationId: string,
  stepId: string,
): Promise<{ ok: boolean; done: number; total: number }> {
  const store = getStore();
  const briefing = store.briefings.find(
    (b) => b.publicationId === publicationId,
  );
  const step = briefing?.actionPlan.find((s) => s.id === stepId);
  if (!briefing || !step) return { ok: false, done: 0, total: 0 };
  step.done = !step.done;
  persistStore();
  const done = briefing.actionPlan.filter((s) => s.done).length;
  revalidatePath(`/publications/${publicationId}`);
  return { ok: true, done, total: briefing.actionPlan.length };
}

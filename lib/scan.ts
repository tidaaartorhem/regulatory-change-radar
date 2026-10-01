import type {
  Briefing,
  Control,
  ControlMapping,
  Publication,
  StoreShape,
  Summarizer,
} from "@/lib/types";
import { upsertPublications, type IngestInput } from "@/lib/ingest/store";
import { scorePublication } from "@/lib/map/mapper";
import { classifyWithLlmGate } from "@/lib/map/llmGate";
import { generateBriefing } from "@/lib/brief/briefing";

export interface ScanReport {
  added: number;
  skipped: number;
  publicationIds: string[];
  at: string;
}

/**
 * The radar pipeline, in order:
 *   1. ingest + dedupe (deterministic)
 *   2. summarize (deterministic extraction by default)
 *   3. map to controls (deterministic taxonomy scoring; the LLM gate fires
 *      ONLY when an LLM-backed adapter is configured, and only as a
 *      classifier against the closed taxonomy)
 *   4. assemble the briefing (deterministic composition)
 *
 * "Leashed LLM": there is exactly one place a model can influence output —
 * step 3's gate — and its IDs are validated against the fixed taxonomy.
 */
export async function runScan(
  store: StoreShape,
  inputs: IngestInput[],
  summarizer: Summarizer,
  controls: Control[],
  llmGenerate?: (prompt: string) => Promise<string>,
): Promise<ScanReport> {
  const { added, skipped } = upsertPublications(store, inputs);
  const llmUsed = summarizer.usesLlm && typeof llmGenerate === "function";

  for (const pub of added) {
    const summary = await summarizer.summarize({
      title: pub.title,
      text: pub.rawText,
    });

    const taxonomyMappings = scorePublication(
      pub.id,
      pub.title,
      pub.rawText,
      controls,
    );

    let gateMappings: ControlMapping[] = [];
    if (llmUsed && llmGenerate) {
      gateMappings = await classifyWithLlmGate(
        pub.id,
        `${pub.title}\n${pub.rawText}`,
        controls,
        summarizer,
        llmGenerate,
      );
    }

    // Merge: keep the highest score per control; taxonomy wins ties
    // (deterministic evidence beats model confidence in compliance).
    const merged = new Map<string, ControlMapping>();
    for (const m of [...gateMappings, ...taxonomyMappings]) {
      const existing = merged.get(m.controlId);
      if (!existing || m.score > existing.score) merged.set(m.controlId, m);
    }
    const mappings = [...merged.values()].sort((a, b) => b.score - a.score);

    const briefing: Briefing = generateBriefing(
      pub,
      summary,
      mappings.map((m) => m.controlId),
      controls,
      llmUsed,
    );

    store.mappings.push(...mappings);
    store.briefings.push(briefing);
  }

  store.lastScanAt = new Date().toISOString();
  return {
    added: added.length,
    skipped,
    publicationIds: added.map((p: Publication) => p.id),
    at: store.lastScanAt,
  };
}

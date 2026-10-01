/**
 * Core domain types for Regulatory Change Radar.
 *
 * Design note (the "Leashed LLM"): every stage of the pipeline is plain
 * deterministic code EXCEPT one — mapping regulatory text onto the fixed
 * control taxonomy (`lib/map/llmGate.ts`). The LLM may only emit control IDs
 * drawn from the closed taxonomy below, and every ID is validated before it
 * can influence a briefing. In compliance, hallucination is unacceptable, so
 * the model stays on a leash.
 */

export type Jurisdiction = "US" | "CA";
export type Sector = "banking" | "insurance" | "cyber";
export type Severity = "critical" | "high" | "medium" | "low";

export interface RegulatorSource {
  id: string;
  name: string;
  shortName: string;
  jurisdiction: Jurisdiction;
  sectors: Sector[];
  /** Verified working RSS feed URL, when one exists. */
  rssUrl?: string;
  /** Human newsroom/listing page used when there is no usable RSS feed. */
  htmlUrl: string;
  feedStatus: "rss-verified" | "html-fallback";
  pollIntervalHours: number;
}

export interface Publication {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  publishedAt: string; // ISO date
  rawText: string;
  contentHash: string;
  jurisdiction: Jurisdiction;
  sectors: Sector[];
  /** When this item was retrieved by the radar (ISO datetime). */
  ingestedAt: string;
}

export interface Control {
  id: string;
  framework: string;
  title: string;
  description: string;
  sectors: Sector[];
  /** Taxonomy keywords used by the deterministic mapper. */
  keywords: string[];
}

export interface ControlMapping {
  publicationId: string;
  controlId: string;
  /** 0..1 */
  score: number;
  matchedKeywords: string[];
  method: "taxonomy" | "llm-gate";
}

export interface SuggestedAction {
  action: string;
  owner: string;
}

export interface Briefing {
  publicationId: string;
  whatChanged: string[];
  affectedControls: string[];
  severity: Severity;
  severityReasons: string[];
  suggestedActions: SuggestedAction[];
  generatedAt: string;
  /** Transparency for auditors: did the LLM gate fire for this briefing? */
  llmUsed: boolean;
}

export interface ScanSourceResult {
  source: string;
  ok: boolean;
  detail: string;
}

export interface StoreShape {
  version: 1;
  publications: Publication[];
  mappings: ControlMapping[];
  briefings: Briefing[];
  lastScanAt: string | null;
  /** Most recent scan report, so failures are visible instead of silent. */
  lastScanReport?: {
    at: string;
    added: number;
    skipped: number;
    results: ScanSourceResult[];
  };
}

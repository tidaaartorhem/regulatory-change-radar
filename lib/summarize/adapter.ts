export type DocumentKind =
  | "rule"
  | "guidance"
  | "advisory"
  | "enforcement"
  | "notice";

export interface Summary {
  /** Plain-English bullets describing what changed. */
  whatChanged: string[];
  /** Extracted obligations: deadlines, effective dates, must/shall phrases. */
  keyPhrases: string[];
  documentKind: DocumentKind;
}

export interface SummarizeInput {
  title: string;
  text: string;
}

/**
 * Summarizer adapter interface. The default ExtractiveSummarizer is fully
 * deterministic and needs no keys. LLM-backed adapters exist ONLY to feed the
 * single gated call site in lib/map/llmGate.ts — they are never used for
 * free-form briefing text, because in compliance every word must be auditable.
 */
export interface Summarizer {
  readonly name: string;
  readonly usesLlm: boolean;
  summarize(input: SummarizeInput): Promise<Summary> | Summary;
}

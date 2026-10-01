import type { Control, ControlMapping } from "@/lib/types";

const TITLE_WEIGHT = 3;
const TEXT_WEIGHT = 1;
/** Minimum score for a mapping to be reported. */
export const MAPPING_THRESHOLD = 0.12;
const MAX_MAPPINGS = 8;

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

/**
 * Deterministic taxonomy scoring. Each control carries a keyword list; a
 * publication scores by weighted keyword hits (title hits count 3x). No LLM
 * involved — the mapping is fully explainable via `matchedKeywords`, which is
 * what auditors actually want to see.
 */
export function scorePublication(
  publicationId: string,
  title: string,
  text: string,
  controls: Control[],
): ControlMapping[] {
  const titleLower = title.toLowerCase();
  const textLower = text.toLowerCase();

  const scored: ControlMapping[] = [];
  for (const control of controls) {
    const matchedKeywords: string[] = [];
    let weighted = 0;
    for (const kw of control.keywords) {
      const k = kw.toLowerCase();
      const hits =
        countOccurrences(titleLower, k) * TITLE_WEIGHT +
        countOccurrences(textLower, k) * TEXT_WEIGHT;
      if (hits > 0) {
        matchedKeywords.push(kw);
        weighted += hits;
      }
    }
    if (matchedKeywords.length === 0) continue;
    // Normalize: a control whose every keyword appears once in the title
    // scores 1.0; partial evidence scores proportionally.
    const score = Math.min(
      1,
      weighted / (control.keywords.length * TITLE_WEIGHT),
    );
    if (score >= MAPPING_THRESHOLD) {
      scored.push({
        publicationId,
        controlId: control.id,
        score: Math.round(score * 100) / 100,
        matchedKeywords,
        method: "taxonomy",
      });
    }
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MAPPINGS);
}

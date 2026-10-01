import type { Control, ControlMapping, Summarizer } from "@/lib/types";

/**
 * THE single LLM call site in the entire codebase ("the leash").
 *
 * The model is asked to do exactly one job — classify regulatory text against
 * the FIXED control taxonomy — and its output is validated before it can
 * influence anything:
 *   1. The prompt lists only control IDs from the closed taxonomy.
 *   2. Any returned ID not in that list is dropped (hallucinated controls
 *      can never enter a briefing).
 *   3. Scores are clamped to [0, 1].
 *   4. If the adapter is not LLM-backed (the default demo), the gate stays
 *      shut and the deterministic taxonomy scorer is the only mapper.
 *
 * Everything else — ingest, dedupe, diffing, severity, briefing assembly —
 * is plain deterministic code.
 */
export async function classifyWithLlmGate(
  publicationId: string,
  text: string,
  candidates: Control[],
  adapter: Summarizer,
  generate: (prompt: string) => Promise<string>,
): Promise<ControlMapping[]> {
  if (!adapter.usesLlm) return [];

  const allowed = new Set(candidates.map((c) => c.id));
  const catalog = candidates
    .map((c) => `- ${c.id}: ${c.title}`)
    .join("\n");

  const prompt = [
    "You are a compliance classification engine. Map the regulatory text below",
    "to controls from the CLOSED list. Rules:",
    "1. Respond with ONLY a JSON array: [{\"controlId\": string, \"score\": number}]",
    "2. Use ONLY control IDs from the list. Inventing an ID is a failure.",
    "3. Score is your confidence from 0 to 1.",
    "",
    "CONTROLS:",
    catalog,
    "",
    "REGULATORY TEXT:",
    text.slice(0, 4000),
  ].join("\n");

  let raw: string;
  try {
    raw = await generate(prompt);
  } catch {
    return [];
  }

  let parsed: unknown;
  try {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    parsed = JSON.parse((fenced ? fenced[1] : raw).trim());
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const mappings: ControlMapping[] = [];
  for (const entry of parsed) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as { controlId?: unknown }).controlId !== "string"
    ) {
      continue;
    }
    const { controlId } = entry as { controlId: string; score?: unknown };
    if (!allowed.has(controlId)) continue; // the leash: reject invented IDs
    const score =
      typeof (entry as { score?: unknown }).score === "number"
        ? Math.min(1, Math.max(0, (entry as { score: number }).score))
        : 0.5;
    mappings.push({
      publicationId,
      controlId,
      score: Math.round(score * 100) / 100,
      matchedKeywords: [],
      method: "llm-gate",
    });
  }
  return mappings.sort((a, b) => b.score - a.score).slice(0, 8);
}

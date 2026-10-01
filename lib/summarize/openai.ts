import type {
  Summarizer,
  SummarizeInput,
  Summary,
} from "@/lib/summarize/adapter";

/**
 * Stub adapter for any OpenAI-compatible chat endpoint.
 * Reads credentials ONLY from environment variables at call time; nothing is
 * persisted. When active it may ONLY be invoked through the single gated call
 * site in lib/map/llmGate.ts (control taxonomy classification).
 */
export class OpenAiSummarizer implements Summarizer {
  readonly name = "openai-compatible";
  readonly usesLlm = true;

  summarize(_input: SummarizeInput): Promise<Summary> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        "OpenAiSummarizer is not configured: set OPENAI_API_KEY (and optionally OPENAI_BASE_URL / OPENAI_MODEL). " +
          "The demo runs on the deterministic DemoSummarizer instead.",
      );
    }
    throw new Error(
      "OpenAiSummarizer live calls are intentionally unimplemented in this build. " +
        "Wire your chat-completions call here; its output must still pass through llmGate validation.",
    );
  }
}

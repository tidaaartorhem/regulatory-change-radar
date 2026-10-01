import type {
  Summarizer,
  SummarizeInput,
  Summary,
} from "@/lib/summarize/adapter";

/**
 * Stub adapter for local models served via an Ollama-compatible endpoint.
 * Not wired by default: configure OLLAMA_BASE_URL and OLLAMA_MODEL to use it.
 * When active it may ONLY be invoked through the single gated call site in
 * lib/map/llmGate.ts (control taxonomy classification) — never for free text.
 */
export class OllamaSummarizer implements Summarizer {
  readonly name = "ollama";
  readonly usesLlm = true;

  constructor(
    private readonly baseUrl: string = process.env.OLLAMA_BASE_URL ?? "",
    private readonly model: string = process.env.OLLAMA_MODEL ?? "",
  ) {}

  summarize(_input: SummarizeInput): Promise<Summary> {
    if (!this.baseUrl || !this.model) {
      throw new Error(
        "OllamaSummarizer is not configured: set OLLAMA_BASE_URL and OLLAMA_MODEL. " +
          "The demo runs on the deterministic DemoSummarizer instead.",
      );
    }
    throw new Error(
      "OllamaSummarizer live calls are intentionally unimplemented in this build. " +
        "Wire your /api/generate call here; its output must still pass through llmGate validation.",
    );
  }
}

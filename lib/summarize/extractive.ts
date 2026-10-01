import type {
  DocumentKind,
  Summarizer,
  SummarizeInput,
  Summary,
} from "@/lib/summarize/adapter";

const SIGNAL_WORDS = [
  "require",
  "must",
  "shall",
  "new",
  "amendment",
  "effective",
  "deadline",
  "mandatory",
  "prohibit",
  "revise",
  "update",
  "introduce",
];

const DATE_PATTERNS: RegExp[] = [
  /effective\s+[A-Z][a-z]+\s+\d{1,2},?\s+\d{4}/gi,
  /within\s+\d+\s+(?:business\s+)?days?/gi,
  /within\s+\d+\s+hours?/gi,
  /by\s+[A-Z][a-z]+\s+\d{1,2},?\s+\d{4}/gi,
  /no\s+later\s+than\s+[A-Z][a-z]+\s+\d{1,2},?\s+\d{4}/gi,
];

const KIND_RULES: Array<{ kind: DocumentKind; pattern: RegExp }> = [
  { kind: "enforcement", pattern: /enforcement|penalt|fine|civil money/i },
  {
    kind: "rule",
    pattern: /final rule|amendment|regulation|requires|requirement|mandatory/i,
  },
  { kind: "guidance", pattern: /guideline|guidance|expectation|best practice/i },
  { kind: "advisory", pattern: /advisory|alert|threat|vulnerability|campaign/i },
];

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 24);
}

function sentenceScore(s: string): number {
  const lower = s.toLowerCase();
  let score = 0;
  for (const w of SIGNAL_WORDS) {
    if (lower.includes(w)) score += 2;
  }
  if (/\d/.test(s)) score += 1; // dates, thresholds, section numbers
  return score;
}

/**
 * ExtractiveSummarizer — deterministic, template-based, zero API keys.
 * Same input always yields the same summary, which is exactly what a
 * compliance audit trail needs. It extracts rather than invents: bullets are
 * verbatim sentences from the source text, ranked by regulatory signal words.
 */
export class ExtractiveSummarizer implements Summarizer {
  readonly name = "extractive";
  readonly usesLlm = false;

  summarize({ title, text }: SummarizeInput): Summary {
    const sents = sentences(text);
    const ranked = [...sents].sort(
      (a, b) => sentenceScore(b) - sentenceScore(a),
    );
    const whatChanged = ranked.slice(0, 3);
    if (whatChanged.length === 0 && title) {
      whatChanged.push(title);
    }

    const keyPhrases: string[] = [];
    for (const re of DATE_PATTERNS) {
      const matches = text.match(re);
      if (matches) keyPhrases.push(...matches.slice(0, 3).map((m) => m.trim()));
    }

    const haystack = `${title} ${text}`;
    const kind =
      KIND_RULES.find((r) => r.pattern.test(haystack))?.kind ?? "notice";

    return {
      whatChanged,
      keyPhrases: [...new Set(keyPhrases)].slice(0, 5),
      documentKind: kind,
    };
  }
}

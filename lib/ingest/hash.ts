import { createHash } from "crypto";

/** Normalize text so trivial formatting differences don't change the hash. */
export function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Stable content fingerprint for a publication. Deterministic: the same
 * regulatory text always produces the same hash, so re-polls never create
 * duplicates.
 */
export function contentHash(title: string, text: string): string {
  return createHash("sha256")
    .update(normalizeText(`${title}\n${text}`))
    .digest("hex");
}

/** Short, human-scannable publication id derived from the content hash. */
export function publicationId(sourceId: string, hash: string): string {
  return `${sourceId}-${hash.slice(0, 12)}`;
}

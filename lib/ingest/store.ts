import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type { Publication, StoreShape } from "@/lib/types";
import { contentHash, publicationId } from "@/lib/ingest/hash";

const EMPTY: StoreShape = {
  version: 1,
  publications: [],
  mappings: [],
  briefings: [],
  lastScanAt: null,
};

/** Resolve the store path: DATA_DIR env override, else <cwd>/data/store.json. */
export function storePath(): string {
  const dir = process.env.DATA_DIR ?? join(process.cwd(), "data");
  return join(dir, "store.json");
}

export function loadStore(path: string = storePath()): StoreShape {
  if (!existsSync(path)) return structuredClone(EMPTY);
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (parsed?.version !== 1 || !Array.isArray(parsed.publications)) {
      return structuredClone(EMPTY);
    }
    return parsed as StoreShape;
  } catch {
    return structuredClone(EMPTY);
  }
}

/** Best-effort write: falls back to a temp path when the data dir is read-only. */
export function saveStore(store: StoreShape, path: string = storePath()): string {
  const attempts = [path, join("/tmp", "rcr-store.json")];
  let lastError: unknown = null;
  for (const p of attempts) {
    try {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify(store, null, 2));
      return p;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("store write failed");
}

export interface IngestInput {
  sourceId: string;
  title: string;
  link: string;
  publishedAt: string;
  text: string;
  jurisdiction: Publication["jurisdiction"];
  sectors: Publication["sectors"];
}

/**
 * Insert publications, skipping any whose content hash is already present.
 * Dedupe is the load-bearing correctness property of the radar: regulators
 * re-publish and feeds overlap, and a compliance team must never triage the
 * same item twice.
 */
export function upsertPublications(
  store: StoreShape,
  inputs: IngestInput[],
): { added: Publication[]; skipped: number } {
  const seen = new Set(store.publications.map((p) => p.contentHash));
  const added: Publication[] = [];
  let skipped = 0;
  for (const input of inputs) {
    const hash = contentHash(input.title, input.text);
    if (seen.has(hash)) {
      skipped += 1;
      continue;
    }
    seen.add(hash);
    added.push({
      id: publicationId(input.sourceId, hash),
      sourceId: input.sourceId,
      title: input.title,
      url: input.link,
      publishedAt: input.publishedAt,
      rawText: input.text,
      contentHash: hash,
      jurisdiction: input.jurisdiction,
      sectors: input.sectors,
      ingestedAt: new Date().toISOString(),
    });
  }
  store.publications.push(...added);
  return { added, skipped };
}

import { readFileSync } from "fs";
import { join } from "path";
import type {
  Briefing,
  Control,
  ControlMapping,
  Publication,
  RegulatorSource,
  Severity,
  StoreShape,
} from "@/lib/types";
import { loadStore, saveStore } from "@/lib/ingest/store";

/**
 * Server-side data access. The JSON store is seeded at build time; an
 * in-memory copy serves reads and absorbs "Run scan" writes, with a
 * best-effort persist for environments with a writable filesystem.
 */
let memStore: StoreShape | null = null;

export function getStore(): StoreShape {
  if (!memStore) memStore = loadStore();
  return memStore;
}

export function persistStore(): void {
  try {
    saveStore(getStore());
  } catch {
    // Read-only filesystems (serverless): the in-memory store still serves.
  }
}

let sourcesCache: RegulatorSource[] | null = null;
export function getSources(): RegulatorSource[] {
  if (!sourcesCache) {
    sourcesCache = JSON.parse(
      readFileSync(join(process.cwd(), "data", "sources.json"), "utf8"),
    );
  }
  return sourcesCache;
}

let controlsCache: Control[] | null = null;
export function getAllControls(): Control[] {
  if (!controlsCache) {
    controlsCache = JSON.parse(
      readFileSync(join(process.cwd(), "data", "controls.seed.json"), "utf8"),
    );
  }
  return controlsCache;
}

export function sourceById(id: string): RegulatorSource | undefined {
  return getSources().find((s) => s.id === id);
}

export interface PublicationView {
  publication: Publication;
  source: RegulatorSource | undefined;
  severity: Severity;
  briefing: Briefing | undefined;
  mappingCount: number;
}

export function getPublicationViews(): PublicationView[] {
  const store = getStore();
  const briefingByPub = new Map(store.briefings.map((b) => [b.publicationId, b]));
  const mappingCount = new Map<string, number>();
  for (const m of store.mappings) {
    mappingCount.set(m.publicationId, (mappingCount.get(m.publicationId) ?? 0) + 1);
  }
  return store.publications
    .map((p) => ({
      publication: p,
      source: sourceById(p.sourceId),
      severity: briefingByPub.get(p.id)?.severity ?? ("low" as const),
      briefing: briefingByPub.get(p.id),
      mappingCount: mappingCount.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.publication.publishedAt.localeCompare(a.publication.publishedAt));
}

export function getPublicationDetail(id: string): {
  publication: Publication;
  source: RegulatorSource | undefined;
  briefing: Briefing | undefined;
  mappings: Array<ControlMapping & { control: Control | undefined }>;
} | null {
  const store = getStore();
  const publication = store.publications.find((p) => p.id === id);
  if (!publication) return null;
  const controls = new Map(getAllControls().map((c) => [c.id, c]));
  return {
    publication,
    source: sourceById(publication.sourceId),
    briefing: store.briefings.find((b) => b.publicationId === id),
    mappings: store.mappings
      .filter((m) => m.publicationId === id)
      .sort((a, b) => b.score - a.score)
      .map((m) => ({ ...m, control: controls.get(m.controlId) })),
  };
}

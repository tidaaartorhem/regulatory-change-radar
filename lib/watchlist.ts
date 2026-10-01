import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

export interface Watchlist {
  /** Enabled regulator source ids. */
  sources: string[];
  sectors: Array<"banking" | "insurance" | "cyber">;
}

const DEFAULTS: Watchlist = {
  sources: [
    "sec", "cisa", "nist", "finra", "occ", "fdic", "fed", "cfpb",
    "nydfs", "naic", "ftc", "osfi", "fcac", "boc", "fsra", "amf", "cccs",
  ],
  sectors: ["banking", "insurance", "cyber"],
};

function watchlistPath(): string {
  const dir = process.env.DATA_DIR ?? join(process.cwd(), "data");
  return join(dir, "watchlist.json");
}

let cache: Watchlist | null = null;

export function getWatchlist(): Watchlist {
  if (cache) return cache;
  try {
    const raw = JSON.parse(readFileSync(watchlistPath(), "utf8"));
    if (Array.isArray(raw.sources)) {
      cache = { sources: raw.sources, sectors: raw.sectors ?? DEFAULTS.sectors };
      return cache;
    }
  } catch {
    // fall through to defaults
  }
  cache = structuredClone(DEFAULTS);
  return cache;
}

export function saveWatchlist(w: Watchlist): void {
  cache = w;
  try {
    const p = watchlistPath();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(w, null, 2));
  } catch {
    // Read-only filesystem: in-memory selection still applies to this instance.
  }
}

export function defaultWatchlist(): Watchlist {
  return structuredClone(DEFAULTS);
}

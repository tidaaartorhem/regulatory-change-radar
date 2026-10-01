import { mkdtempSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  loadStore,
  saveStore,
  upsertPublications,
  type IngestInput,
} from "@/lib/ingest/store";

function input(overrides: Partial<IngestInput> = {}): IngestInput {
  return {
    sourceId: "osfi",
    title: "OSFI B-13 update",
    link: "https://example.com/b13",
    publishedAt: "2024-01-15T00:00:00Z",
    text: "Revised technology and cyber risk guideline.",
    jurisdiction: "CA",
    sectors: ["banking"],
    ...overrides,
  };
}

describe("upsertPublications", () => {
  it("adds new publications", () => {
    const store = loadStore("/nonexistent/path.json");
    const { added, skipped } = upsertPublications(store, [input()]);
    expect(added).toHaveLength(1);
    expect(skipped).toBe(0);
    expect(store.publications).toHaveLength(1);
  });

  it("skips exact duplicates by content hash", () => {
    const store = loadStore("/nonexistent/path.json");
    upsertPublications(store, [input()]);
    const { added, skipped } = upsertPublications(store, [input()]);
    expect(added).toHaveLength(0);
    expect(skipped).toBe(1);
    expect(store.publications).toHaveLength(1);
  });

  it("treats same title with different text as new", () => {
    const store = loadStore("/nonexistent/path.json");
    upsertPublications(store, [input()]);
    const { added } = upsertPublications(store, [
      input({ text: "Completely different body text here." }),
    ]);
    expect(added).toHaveLength(1);
  });

  it("handles mixed batches", () => {
    const store = loadStore("/nonexistent/path.json");
    upsertPublications(store, [input()]);
    const { added, skipped } = upsertPublications(store, [
      input(), // dup
      input({ title: "Second item", text: "Fresh content for the radar." }),
      input({ title: "Third item", text: "More fresh regulatory content." }),
    ]);
    expect(added).toHaveLength(2);
    expect(skipped).toBe(1);
  });
});

describe("saveStore / loadStore", () => {
  it("round-trips through disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "rcr-"));
    const path = join(dir, "store.json");
    const store = loadStore(path);
    upsertPublications(store, [input({ seeded: true })]);
    saveStore(store, path);
    const reloaded = loadStore(path);
    expect(reloaded.publications).toHaveLength(1);
    expect(reloaded.publications[0].seeded).toBe(true);
    expect(JSON.parse(readFileSync(path, "utf8")).version).toBe(1);
  });

  it("returns an empty store for corrupt files", () => {
    const dir = mkdtempSync(join(tmpdir(), "rcr-"));
    const path = join(dir, "store.json");
    require("fs").writeFileSync(path, "not json{{{");
    expect(loadStore(path).publications).toHaveLength(0);
  });
});

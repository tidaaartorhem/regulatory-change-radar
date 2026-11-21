import { describe, expect, it } from "vitest";
import {
  formatFailureReport,
  ingestExitCode,
} from "@/lib/ingest/failures";
import type { ScanSourceResult } from "@/lib/types";

function result(source: string, ok: boolean, detail = ""): ScanSourceResult {
  return { source, ok, detail };
}

describe("ingestExitCode", () => {
  it("is 0 when every source succeeded", () => {
    expect(
      ingestExitCode([result("OSFI", true, "+3 items"), result("FDIC", true, "+5 items")]),
    ).toBe(0);
  });

  it("is 1 when even one source failed", () => {
    expect(
      ingestExitCode([
        result("OSFI", true, "+3 items"),
        result("FCAC", false, "Firecrawl 429: rate limited"),
      ]),
    ).toBe(1);
  });

  it("is 1 when all sources failed", () => {
    expect(
      ingestExitCode([result("FCAC", false, "429"), result("FSRA", false, "429")]),
    ).toBe(1);
  });
});

describe("formatFailureReport", () => {
  it("is empty when nothing failed", () => {
    expect(formatFailureReport([result("OSFI", true, "+3 items")])).toBe("");
  });

  it("names every failed source with its detail", () => {
    const report = formatFailureReport([
      result("OSFI", true, "+3 items"),
      result("FCAC", false, "Firecrawl 429: rate limited"),
      result("AMF", false, "fetch failed: timeout"),
    ]);
    expect(report).toContain("2 of 3 source(s) FAILED");
    expect(report).toContain("FCAC: Firecrawl 429: rate limited");
    expect(report).toContain("AMF: fetch failed: timeout");
    expect(report).toContain("exiting non-zero");
    expect(report).not.toContain("OSFI");
  });
});

/**
 * Loud ingest failures: when a regulator source errors during a scan, the
 * ingest process must say so plainly and exit non-zero — a quiet warn in a
 * build log is how the radar silently went 17 days without fresh data in
 * October. The failure is also recorded in the store's lastScanReport, so
 * the dashboard banner can show it.
 *
 * Exit-code rule: 1 if ANY source failed, 0 only when every source
 * succeeded. The `build` npm script tolerates a failed ingest (`|| true`)
 * so a deploy never fails because a regulator's newsroom was down — the
 * build proceeds with the committed store, and the failure stays loud in
 * the build log and in lastScanReport.
 */
import type { ScanSourceResult } from "@/lib/types";

/** Non-zero when any source failed — the ingest's exit code. */
export function ingestExitCode(results: ScanSourceResult[]): 0 | 1 {
  return results.some((r) => !r.ok) ? 1 : 0;
}

/** The loud block printed to stderr when sources fail. Empty when all ok. */
export function formatFailureReport(results: ScanSourceResult[]): string {
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) return "";
  const lines = [
    `ingest: ${failed.length} of ${results.length} source(s) FAILED — data was NOT refreshed for:`,
    ...failed.map((r) => `  - ${r.source}: ${r.detail}`),
    "ingest: exiting non-zero; see the dashboard banner / lastScanReport for the recorded failure.",
  ];
  return lines.join("\n");
}

import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { describeDaysOld, getDataAge } from "@/lib/dataAge";

function formatScanDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Data-age banner for the dashboard: states, in plain language, how fresh
 * the regulator data is. Fresh data gets a quiet confirmation; stale data
 * gets an amber warning a compliance reader cannot miss; a store that has
 * never scanned says so instead of implying currency. Failed sources from
 * the last scan report are named, so a partial refresh is visible too.
 */
export function DataAgeBanner({
  lastScanAt,
  failedSources = 0,
  totalSources = 0,
}: {
  lastScanAt: string | null;
  failedSources?: number;
  totalSources?: number;
}) {
  const age = getDataAge(lastScanAt);
  const failedNote =
    failedSources > 0 && totalSources > 0
      ? ` ${failedSources} of ${totalSources} sources failed in the last scan, so those regulators were not refreshed.`
      : "";

  if (age.status === "unknown") {
    return (
      <div
        role="status"
        className="mb-6 flex items-start gap-3 rounded-md border border-line-strong bg-tag-bg p-4 text-[15px] text-ink"
      >
        <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft" />
        <p>
          No successful scan has run yet — the data below may be out of date.
        </p>
      </div>
    );
  }

  if (age.status === "stale") {
    return (
      <div
        role="alert"
        className="mb-6 flex items-start gap-3 rounded-md border border-sev-high-fg/40 bg-sev-high-bg p-4 text-[15px] text-sev-high-fg"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          <strong>
            Regulator data is {age.daysOld} days old — last successful scan{" "}
            {formatScanDate(age.lastScanAt!)}.
          </strong>{" "}
          Treat this feed as out of date until the next scan runs.
          {failedNote}
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3 rounded-md border border-line bg-primary-tint p-4 text-[15px] text-primary-darker"
    >
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
      <p>
        Data current — last scan {formatScanDate(age.lastScanAt!)} (
        {describeDaysOld(age.daysOld)}).{failedNote}
      </p>
    </div>
  );
}

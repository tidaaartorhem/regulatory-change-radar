import { Play, Rss, Globe } from "lucide-react";
import { getSources, getStore } from "@/lib/data";
import { getWatchlist } from "@/lib/watchlist";
import { firecrawlEnabled } from "@/lib/ingest/firecrawl";
import { runScanAction, saveWatchlistAction } from "@/app/actions";
import { cn } from "@/lib/cn";

export default async function WatchlistPage() {
  const sources = getSources();
  const watchlist = getWatchlist();
  const store = getStore();
  const live = firecrawlEnabled();

  async function handleScan() {
    "use server";
    const result = await runScanAction();
    // Surface the outcome via a re-rendered page; details in server logs.
    console.log(
      `scan: +${result.added} added, ${result.skipped} skipped`,
      result.notes,
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-3xl font-bold text-ink">Watchlist</h1>
      <p className="mb-6 max-w-3xl text-[15px] text-ink-soft">
        Choose which regulators the radar watches. Scans fetch RSS feeds first;
        HTML-only sources use the Firecrawl scrape adapter when enabled.
      </p>

      <div className="mb-6 rounded-md border border-line bg-paper p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-ink">Run a scan now</p>
            <p className="text-sm text-ink-soft">
              {store.publications.length} publications tracked
              {store.lastScanAt
                ? ` · last scan ${new Date(store.lastScanAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                : ""}
            </p>
          </div>
          <form action={handleScan}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded bg-primary px-5 py-2.5 text-[15px] font-semibold text-white transition hover:bg-primary-dark"
            >
              <Play className="h-4 w-4" aria-hidden /> Run scan
            </button>
          </form>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded border px-2 py-0.5 font-medium",
              live
                ? "border-sev-low-fg/25 bg-sev-low-bg text-sev-low-fg"
                : "border-line-strong bg-canvas text-ink-soft",
            )}
          >
            <Globe className="h-3 w-3" aria-hidden />
            Firecrawl scrape adapter {live ? "enabled" : "disabled"}
          </span>
          <span className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary-tint px-2 py-0.5 font-medium text-primary-dark">
            <Rss className="h-3 w-3" aria-hidden /> RSS first — no key needed
          </span>
        </div>
        {!live && (
          <p className="mt-3 text-sm text-ink-soft">
            HTML-only sources are skipped in this mode. Set{" "}
            <code className="rounded border border-line bg-canvas px-1 font-mono text-[13px]">FIRECRAWL_ENABLED=true</code>{" "}
            to scrape them via the Firecrawl skill (auth stays with the stored
            credential — the app never handles a raw key).
          </p>
        )}
      </div>

      <form action={saveWatchlistAction}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-navy">
            Regulators ({sources.length})
          </h2>
          <button
            type="submit"
            className="rounded border border-line-strong bg-paper px-4 py-2 text-[15px] text-primary underline-offset-2 hover:underline"
          >
            Save selection
          </button>
        </div>
        <div className="space-y-2">
          {sources.map((s) => {
            const enabled = watchlist.sources.includes(s.id);
            return (
              <label
                key={s.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md border bg-paper p-4 transition",
                  enabled
                    ? "border-primary"
                    : "border-line opacity-70",
                )}
              >
                <input
                  type="checkbox"
                  name={`src-${s.id}`}
                  defaultChecked={enabled}
                  className="h-5 w-5 shrink-0 accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-ink">
                    {s.shortName}
                    <span className="ml-2 text-sm font-normal text-ink-soft">{s.name}</span>
                  </p>
                  <p className="text-[13px] capitalize text-ink-faint">
                    {s.jurisdiction === "US" ? "United States" : "Canada"} ·{" "}
                    {s.sectors.join(", ")}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium",
                    s.feedStatus === "rss-verified"
                      ? "border-sev-low-fg/25 bg-sev-low-bg text-sev-low-fg"
                      : "border-sev-medium-fg/30 bg-sev-medium-bg text-sev-medium-fg",
                  )}
                >
                  {s.feedStatus === "rss-verified" ? (
                    <><Rss className="h-3 w-3" aria-hidden /> RSS</>
                  ) : (
                    <><Globe className="h-3 w-3" aria-hidden /> HTML + Firecrawl</>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </form>
    </div>
  );
}

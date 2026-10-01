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
      <h1 className="mb-1 text-2xl font-bold text-white">Watchlist</h1>
      <p className="mb-6 text-sm text-slate-400">
        Choose which regulators the radar watches. Scans fetch RSS feeds first;
        HTML-only sources use the Firecrawl scrape adapter when enabled.
      </p>

      <div className="mb-6 rounded-xl border border-[#1b2740] bg-[#0b1220]/80 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-100">Run a scan now</p>
            <p className="text-xs text-slate-400">
              {store.publications.length} publications tracked
              {store.lastScanAt
                ? ` · last scan ${new Date(store.lastScanAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                : ""}
            </p>
          </div>
          <form action={handleScan}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-[#060a13] transition hover:bg-sky-400"
            >
              <Play className="h-4 w-4" /> Run scan
            </button>
          </form>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
              live
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-slate-500/40 bg-slate-500/10 text-slate-400",
            )}
          >
            <Globe className="h-3 w-3" />
            Firecrawl scrape adapter {live ? "enabled" : "disabled"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-sky-300">
            <Rss className="h-3 w-3" /> RSS first — no key needed
          </span>
        </div>
        {!live && (
          <p className="mt-3 text-xs text-slate-500">
            HTML-only sources are skipped in this mode. Set{" "}
            <code className="rounded bg-white/10 px-1 font-mono">FIRECRAWL_ENABLED=true</code>{" "}
            to scrape them via the Firecrawl skill (auth stays with the stored
            credential — the app never handles a raw key).
          </p>
        )}
      </div>

      <form action={saveWatchlistAction}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
            Regulators ({sources.length})
          </h2>
          <button
            type="submit"
            className="rounded-lg border border-[#1b2740] px-3 py-1.5 text-sm text-slate-300 transition hover:border-sky-500/50 hover:text-white"
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
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition",
                  enabled
                    ? "border-sky-500/40 bg-[#0b1220]/80"
                    : "border-[#1b2740] bg-[#0b1220]/40 opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  name={`src-${s.id}`}
                  defaultChecked={enabled}
                  className="h-4 w-4 accent-sky-500"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-100">
                    {s.shortName}
                    <span className="ml-2 text-xs font-normal text-slate-400">{s.name}</span>
                  </p>
                  <p className="text-[11px] capitalize text-slate-500">
                    {s.jurisdiction === "US" ? "United States" : "Canada"} ·{" "}
                    {s.sectors.join(", ")}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    s.feedStatus === "rss-verified"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-300",
                  )}
                >
                  {s.feedStatus === "rss-verified" ? (
                    <><Rss className="h-3 w-3" /> RSS</>
                  ) : (
                    <><Globe className="h-3 w-3" /> HTML + Firecrawl</>
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

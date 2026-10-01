import { Suspense } from "react";
import { Activity, AlertTriangle, Library, Radio } from "lucide-react";
import {
  getPublicationViews,
  getSources,
  getStore,
} from "@/lib/data";
import { PublicationCard } from "@/components/publication-card";
import { FeedFilters } from "@/components/feed-filters";
import type { Severity } from "@/lib/types";

interface SearchParams {
  severity?: string;
  regulator?: string;
  sector?: string;
  jurisdiction?: string;
}

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-md border border-line bg-paper p-4">
      <div className="mb-1 flex items-center gap-2 text-primary">{icon}</div>
      <p className="text-3xl font-bold text-ink">{value}</p>
      <p className="text-sm text-ink-soft">{label}</p>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const sources = getSources();
  const store = getStore();
  let views = getPublicationViews();

  if (params.severity) views = views.filter((v) => v.severity === params.severity);
  if (params.regulator)
    views = views.filter((v) => v.publication.sourceId === params.regulator);
  if (params.sector)
    views = views.filter((v) => v.publication.sectors.includes(params.sector as "banking"));
  if (params.jurisdiction)
    views = views.filter((v) => v.publication.jurisdiction === params.jurisdiction);

  // Sort: severity first, then newest.
  views = [...views].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      b.publication.publishedAt.localeCompare(a.publication.publishedAt),
  );

  const critical = store.briefings.filter((b) => b.severity === "critical").length;
  const mappedControls = new Set(store.mappings.map((m) => m.controlId)).size;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-ink">Regulatory feed</h1>
        <p className="mt-2 max-w-3xl text-[15px] text-ink-soft">
          Every item below was ingested, deduplicated, summarized, and mapped
          to controls by the radar pipeline — no manual triage.
          {store.lastScanAt && (
            <>
              {" "}Last scan{" "}
              {new Date(store.lastScanAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              .
            </>
          )}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={<Activity className="h-5 w-5" />} label="Publications tracked" value={store.publications.length} />
        <Stat icon={<AlertTriangle className="h-5 w-5" />} label="Critical severity" value={critical} />
        <Stat icon={<Library className="h-5 w-5" />} label="Controls touched" value={mappedControls} />
        <Stat icon={<Radio className="h-5 w-5" />} label="Regulators watched" value={sources.length} />
      </div>

      <Suspense>
        <FeedFilters sources={sources} />
      </Suspense>

      {views.length === 0 ? (
        <div className="rounded-md border border-dashed border-line-strong bg-paper p-10 text-center text-[15px] text-ink-soft">
          No publications match these filters. Try clearing them — or run a
          scan from the Watchlist page.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {views.map((v) => (
            <PublicationCard key={v.publication.id} view={v} />
          ))}
        </div>
      )}
    </div>
  );
}

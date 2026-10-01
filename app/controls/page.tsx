import { getAllControls } from "@/lib/data";
import { cn } from "@/lib/cn";

interface SearchParams {
  q?: string;
  framework?: string;
  sector?: string;
}

export default async function ControlsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const controls = getAllControls();
  const frameworks = [...new Set(controls.map((c) => c.framework))];

  let filtered = controls;
  if (params.framework) filtered = filtered.filter((c) => c.framework === params.framework);
  if (params.sector) filtered = filtered.filter((c) => c.sectors.includes(params.sector as "banking"));
  if (params.q) {
    const q = params.q.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q),
    );
  }

  const inputCls =
    "rounded border border-line-strong bg-paper px-3 py-2 text-[15px] text-ink";

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold text-ink">Control library</h1>
      <p className="mb-6 max-w-3xl text-[15px] text-ink-soft">
        The closed taxonomy every publication is mapped against — {controls.length}{" "}
        controls across {frameworks.length} frameworks. The LLM gate may only
        ever emit IDs from this list.
      </p>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-md border border-line bg-paper p-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Search
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search controls…"
            className={cn(inputCls, "w-56")}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Framework
          <select name="framework" defaultValue={params.framework ?? ""} className={inputCls}>
            <option value="">All frameworks</option>
            {frameworks.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Sector
          <select name="sector" defaultValue={params.sector ?? ""} className={inputCls}>
            <option value="">All sectors</option>
            <option value="banking">Banking</option>
            <option value="insurance">Insurance</option>
            <option value="cyber">Cyber</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded bg-primary px-5 py-2 text-[15px] font-semibold text-white transition hover:bg-primary-dark"
        >
          Filter
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="rounded-md border border-line bg-paper p-5"
          >
            <p className="mb-1 font-mono text-sm text-primary-dark">{c.id}</p>
            <h2 className="mb-1 text-base font-semibold text-ink">{c.title}</h2>
            <p className="mb-3 text-sm text-ink-soft">{c.description}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded border border-line bg-canvas px-1.5 py-0.5 text-xs text-ink-soft">
                {c.framework}
              </span>
              {c.sectors.map((s) => (
                <span
                  key={s}
                  className="rounded border border-line bg-canvas px-1.5 py-0.5 text-xs capitalize text-ink-faint"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="mt-6 text-[15px] text-ink-soft">No controls match.</p>
      )}
    </div>
  );
}

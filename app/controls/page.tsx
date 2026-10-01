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
    "rounded-lg border border-[#1b2740] bg-[#0b1220] px-3 py-2 text-sm text-slate-200 outline-none focus:border-sky-500/60";

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-white">Control library</h1>
      <p className="mb-6 text-sm text-slate-400">
        The closed taxonomy every publication is mapped against — {controls.length}{" "}
        controls across {frameworks.length} frameworks. The LLM gate may only
        ever emit IDs from this list.
      </p>

      <form method="get" className="mb-6 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search controls…"
          className={cn(inputCls, "w-56")}
        />
        <select name="framework" defaultValue={params.framework ?? ""} className={inputCls}>
          <option value="">All frameworks</option>
          {frameworks.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <select name="sector" defaultValue={params.sector ?? ""} className={inputCls}>
          <option value="">All sectors</option>
          <option value="banking">Banking</option>
          <option value="insurance">Insurance</option>
          <option value="cyber">Cyber</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-[#060a13] transition hover:bg-sky-400"
        >
          Filter
        </button>
      </form>

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-[#1b2740] bg-[#0b1220]/80 p-4"
          >
            <p className="mb-1 font-mono text-xs text-sky-300">{c.id}</p>
            <h3 className="mb-1 text-sm font-semibold text-slate-100">{c.title}</h3>
            <p className="mb-2 text-xs text-slate-400">{c.description}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                {c.framework}
              </span>
              {c.sectors.map((s) => (
                <span
                  key={s}
                  className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] capitalize text-slate-500"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="mt-6 text-sm text-slate-400">No controls match.</p>
      )}
    </div>
  );
}

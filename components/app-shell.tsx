import Link from "next/link";
import { Radar } from "lucide-react";

const NAV = [
  { href: "/", label: "Feed" },
  { href: "/controls", label: "Control Library" },
  { href: "/watchlist", label: "Watchlist" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[#1b2740] bg-[#060a13]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
            <Radar className="h-5 w-5" />
          </span>
          <div className="mr-6">
            <p className="text-sm font-semibold tracking-wide">
              Regulatory Change Radar
            </p>
            <p className="text-[11px] text-slate-400">
              US + Canada &middot; Banking &middot; Insurance &middot; Cyber
            </p>
          </div>
          <nav className="flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-md px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="radar-grid mx-auto max-w-6xl px-5 py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-5 pb-10 pt-4 text-xs text-slate-500">
        Demo data is seeded and clearly labeled. Connect a summarizer adapter to
        run live scans against regulator feeds.
      </footer>
    </div>
  );
}

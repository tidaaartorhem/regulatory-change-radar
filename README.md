# Regulatory Change Radar

> **Live:** https://regulatory-change-radar-1--truth-or-shots.us-east4.hosted.app

## The problem

Compliance teams at banks, insurers, and security organizations drown in
regulator publications across two countries. The SEC, OSFI, NYDFS, CISA, FINRA,
the Canadian Centre for Cyber Security, and a dozen more each publish guidance,
rules, advisories, and amendments on their own cadence, in their own formats.

Missing one update — an OSFI B-13 revision, a NYDFS Part 500 amendment, a new
SEC disclosure rule — means audit findings, rushed gap assessments, and board
questions nobody can answer quickly. Today this work is done by analysts with
Google Alerts and spreadsheets: slow, unrepeatable, and impossible to audit.

## What this automates

Regulatory Change Radar replaces the spreadsheet with a pipeline:

1. **Watch** — pulls from 17 US and Canadian regulators: verified RSS feeds
   where they exist (SEC, CISA, Bank of Canada), Firecrawl-powered scraping
   for HTML-only newsrooms.
2. **Dedupe** — content-hash fingerprinting means a re-published release is
   never triaged twice.
3. **Summarize** — each publication becomes plain-English "what changed"
   bullets extracted from the source text.
4. **Map** — every item is scored against a fixed control taxonomy (NIST CSF
   2.0, OSFI B-13, NYDFS Part 500, NAIC model law, PCI DSS v4.0, SOC 2).
5. **Brief** — a severity rating with published rules, affected controls,
   and a concrete, ordered **action plan**: assess scope, remediate each
   mapped control, update policies, record attestation — with owners,
   severity-based due dates, and evidence to file. Steps are checkable and
   completion persists in the store.

Every briefing is composed, not generated: identical inputs always produce
identical briefings, and the dataset contains zero seeded or synthetic
publications — only items actually retrieved from regulator sources.

## The core concept: the Leashed LLM

In compliance, hallucination is unacceptable — every output must be auditable
and reproducible. So this system is built as a **deterministic pipeline with
exactly one LLM call site**:

- **Deterministic (plain code):** RSS fetching, sha256 dedupe, sentence
  extraction, taxonomy keyword scoring, severity rules, action-plan assembly.
  Re-run the pipeline and you get byte-identical briefings.
- **The single gated call site** (`lib/map/llmGate.ts`): the model may do one
  job only — classify regulatory text against the *closed* control taxonomy.
  Its output is validated before it can influence anything: unknown control
  IDs are rejected, scores are clamped to [0, 1], and taxonomy evidence wins
  ties. If the adapter isn't LLM-backed (the default), the gate stays shut.
- **Transparency:** every briefing records `llmUsed`, and every mapping is
  labeled `taxonomy` or `llm-gate` with its evidence. The Watchlist scan
  report shows per-source results — failures are reported, never filled in
  with fabricated items.

The lesson: don't ask the model to write the compliance briefing. Ask it to
point at the controls, then check its homework in code.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

- **Dashboard** — severity breakdown, US-vs-Canada split, regulator activity
  timeline, and a control-impact heatmap (controls × recent publications),
  then the filterable feed.
- **Publication detail** — key facts as stat cards, what changed, a trackable
  action-plan stepper (check off steps; owners, due dates, evidence to file),
  mapped controls with confidence bars and keyword evidence.
- **Control Library** — browse the 29-control taxonomy the mapper uses.
- **Watchlist** — pick regulators, hit **Run scan**. Without
  `FIRECRAWL_ENABLED=true`, scans use the RSS adapters and report HTML-only
  sources as failed instead of inventing items for them.

```bash
npm test                 # 63 vitest tests
npm run data:ingest     # live ingestion: RSS + Firecrawl → data/store.json
npm run build           # ingest (build-safe), then production build
```

## Architecture

```
data/
  sources.json            17 regulators: verified RSS URLs or HTML-fallback notes
  controls.seed.json      29 controls, 6 frameworks, keyword taxonomy
  store.json              the live dataset (committed; see below)
lib/
  ingest/
    rss.ts                RSS fetching (rss-parser)
    firecrawl.ts          scrape adapter for HTML-only sources (opt-in)
    live.ts               router: RSS first, then Firecrawl, else fail loudly
    hash.ts               sha256 content fingerprinting
    store.ts              JSON file store + dedupe
  summarize/
    adapter.ts            Summarizer interface
    extractive.ts         deterministic extraction summarizer (default, zero keys)
    ollama.ts / openai.ts documented stubs for local / hosted models
  map/
    taxonomy.ts           the closed control taxonomy
    mapper.ts             deterministic keyword scoring with evidence
    llmGate.ts            THE single LLM call site (validated, clamped)
  brief/
    briefing.ts           deterministic briefing + action-plan assembly
                          (severity rules, control-specific step templates,
                          framework→owner mapping, severity-based due dates)
  scan.ts                 pipeline: ingest → summarize → map → brief
  watchlist.ts            regulator selection persistence
app/
  page.tsx                dashboard: visualizations + feed + filters
  publications/[id]/      briefing detail: stat cards, action plan, controls
  controls/               control library browser
  watchlist/              regulator toggles + Run scan + last-scan report
  actions.ts              server actions (scan, watchlist save, step toggle)
scripts/ingest.ts         build-time live ingestion; build-safe: total outage
                          keeps the committed store and exits 0
```

### Ingestion adapters

| Source type | Adapter | Auth |
|---|---|---|
| RSS feed (SEC, CISA, Bank of Canada) | `rss.ts` | none needed |
| HTML-only newsroom (14 sources) | `firecrawl.ts` → Firecrawl skill CLI | stored `custom.firecrawl` credential via the skill's surrogate mechanism — the app never sees a raw key |
| Unreachable / not enabled | recorded as failed in `lastScanReport` | — |

Enable live HTML scraping with `FIRECRAWL_ENABLED=true`. Without it, only
RSS sources are scanned and the rest are honestly reported as failed.

## The dataset

`data/store.json` is committed and holds the pipeline's real output — no
seeded or synthetic publications, ever. The initial dataset was ingested live
on **2026-10-01**: **152 publications** from 11 regulators (SEC, CISA, NIST,
FINRA, OCC, FDIC, Federal Reserve, CFPB, NYDFS, FTC, Bank of Canada), 104
control mappings, 152 briefings with action plans. Each publication records
its `ingestedAt` retrieval date, and every detail page links the original
source URL.

## Regulators watched

**US:** SEC, FINRA, OCC, FDIC, Federal Reserve, CFPB, NYDFS, NAIC, CISA, NIST, FTC
**Canada:** OSFI, FCAC, Bank of Canada, FSRA (Ontario), AMF (Québec), Canadian Centre for Cyber Security

RSS feeds verified working (Oct 2026): SEC, CISA, Bank of Canada. The rest
use the Firecrawl scrape adapter against their newsroom pages.

## Control frameworks in the taxonomy

NIST CSF 2.0 · OSFI B-13 (Technology and Cyber Risk Management) · NYDFS Part
500 (23 NYCRR 500) · NAIC Insurance Data Security Model Law · PCI DSS v4.0 ·
SOC 2 Trust Services Criteria.

## Deployment

Deploys to Firebase App Hosting: `apphosting.yaml` runs `npm run build`,
which runs the live ingest (build-safe: keeps the committed store on total
outage) before `next build`, so the deployment boots with the real dataset
and zero configuration.

---

*Not affiliated with any government agency or regulator.*

Built as one of 20 projects in 20 days. Author: Aadit Mehrotra.

# Dashboard examples redesign + editorial example removal

Date: 2026-07-10

## Goal

The four existing before/after dashboard examples under `examples/`
(`market-trend-dashboard-{before,after}`, `seo-geo-dashboard-{before,after}`)
are functionally correct but visually bare (unstyled system-font forms).
They need to look like real, polished products — good enough to appear on
screen in a YouTube video — while keeping the existing zero-dependency,
no-build-step, no-external-CDN architecture and the existing `tasks.php`
HTTP contract untouched.

Separately, `examples/editorial-content-automation/` is removed: it's a
heavier, more niche example (image generation, captioning, radar sources)
that dilutes the two dashboard examples as the repo's primary showcase.

## Non-goals

- No change to `core/tasks.php`, `core/runner_remote.py`, or the HTTP
  contract (`?action=add/recent/status/complete`) used by the `-after`
  examples.
- No build tools, bundlers, external CDN scripts/fonts, or chart libraries —
  everything stays vanilla HTML/CSS/JS, charts are hand-rolled inline SVG.
- No new `action_type`s beyond the existing `market_trend` / `seo_geo_audit`.
- No real backend deploy/test as part of this work — visual redesign only,
  reusing the already-verified `tasks.php` copies as-is.

## Visual direction

Both dashboards share a dark, premium register (per user preference) but
each gets its **own** token system and signature element, grounded in its
subject, rather than one reused template — a generic "dark SaaS, teal
accent" look was deliberately avoided as the default AI-generated pattern.

### Market Trend dashboard — "financial terminal" identity

- **Color**: bg `#0a0d0f`, panel `#12161a`, hairline `#232a2f`, text
  `#e8e6e1`, muted `#8b9198`, accent gold/amber `#d4a24c` (ticker vocabulary),
  positive `#3ecf8e`, negative `#e2574c`.
- **Type**: `ui-monospace`/`SF Mono`/`Consolas` stack for all numeric data
  (prices, scores, deltas) to read as measured/live data; `system-ui` for
  labels and prose; uppercase, letter-spaced eyebrow labels for stat
  captions ("SENTIMENT", "24H").
- **Signature element**: a thin amber-on-black **ticker strip** at the very
  top of the page — target symbol, current score, ▲/▼ delta — evoking a
  real market ticker. Everything else (stat cards, chart, job table) stays
  quiet so this one element reads as deliberate.
- **Chart**: inline SVG line chart plotting score-per-job across the
  visible job history (real data, not invented time-series).
- **Job table**: dense, monospace ids/timestamps — reads like a trade
  blotter.

### SEO/GEO Audit dashboard — "inspection report" identity

- **Color**: bg `#0d1210`, panel `#141a18`, hairline `#20302a`, text
  `#e6ece9`, muted `#8a9a93`, accent blue `#6c8cff` (trust/audit), semantic
  pass `#4ade80` / warn `#fbbf24` / fail `#f87171` used only on status
  ticks and the grade badge.
- **Type**: `system-ui` throughout, differentiated from the market-trend
  dashboard via weight/tracking rather than a second font family (no
  external font loading); monospace reserved for the numeric score only.
- **Signature element**: a large **letter-grade placard** (A–F, computed
  from the average of the three sub-scores) styled like a health/energy
  inspection label — deliberately not the generic circular gauge every SEO
  tool clones.
- **Sub-scores**: shown as horizontal "inspection bars" (label + bar +
  numeric value + pass/warn/fail tick) for technical/content/AI-citability.
- **Findings**: checklist rows with ✓/⚠/✕ status icons, one line each.
- **Job table**: same dense report-row style as market-trend, palette-swapped.

### "before" dashboards

Same token system as their "-after" counterpart (so the pair reads as one
family) but a single centered card layout — form + result panel only, no
sidebar/job table, since a direct synchronous API call has no queue state
to show. This keeps the before/after contrast about the *architecture*
(direct call vs. queue), not a visual downgrade.

## Demo data ("-after" dashboards only)

`app.js` ships a small `DEMO_JOBS` array (4 realistic entries per
dashboard, Italian copy, covering `done`/`running`/`error` states so the
full status-badge set is visible). On load, if no token is saved, or the
real `tasks.php` call returns zero jobs, the page renders the demo set with
a visible amber banner: *"Dati di esempio — collega un token per i dati
reali."* As soon as a real call returns ≥1 job, demo data is dropped and
never mixed with real data. This keeps every screenshot/video alive without
misrepresenting demo numbers as live ones.

Market-trend demo jobs: BTC (`done`, score 72, positive, +3.2% 24h), "agentic
AI" keyword (`done`, score 65, neutral), ETH (`running`), SOL (`error`).

SEO/GEO demo jobs: `esempio.com` (`done`, technical 68 / content 74 /
ai-citability 55 → grade C), `esempio.com` + keyword (`done`, higher scores
→ grade B), a second domain (`running`), a third (`error`).

## Editorial example removal

Delete `examples/editorial-content-automation/` entirely (all files,
including `__pycache__`). Update references so the dashboards become the
repo's example showcase:

- `CLAUDE.md` / `CLAUDE.it.md`: §Phase 3 point 4 and §5 "Extending the
  connector" — replace the `editorial-content-automation` pointer with a
  pointer to `examples/market-trend-dashboard-after/` (or seo-geo) as the
  "substantial case" reference.
- `README.md` / `README.it.md`: file table row and "Full example" section —
  same replacement.
- `CHANGELOG.md` / `CHANGELOG.it.md`: **not touched** (historical record).
- `docs/superpowers/specs/` and `docs/superpowers/plans/` prior documents
  that mention the editorial example: left as-is (historical, dated specs,
  not living docs).

## File layout (unchanged paths, content rewritten)

```
examples/
  market-trend-dashboard-before/{index.html, app.js, README.md}
  market-trend-dashboard-after/{index.html, app.js, tasks.php*, CLAUDE-addendum.md, domain-config-snippet.json, README.md}
  seo-geo-dashboard-before/{index.html, app.js, README.md}
  seo-geo-dashboard-after/{index.html, app.js, tasks.php*, CLAUDE-addendum.md, domain-config-snippet.json, README.md}
```
`tasks.php` copies are untouched (already byte-identical to `core/tasks.php`
per the prior implementation; no change needed here).

Removed:
```
examples/editorial-content-automation/   (entire folder)
```

## Testing flow

- `node --check` on every rewritten `app.js`.
- Open each `index.html` directly in a browser (file://) and visually
  verify: layout renders, demo data populates on first load, stat
  cards/chart/grade badge render correctly, responsive down to a narrow
  viewport, no console errors.
- Grep-verify no remaining `editorial-content-automation` references outside
  `CHANGELOG*.md` and the dated `docs/superpowers/` documents.
- `git status --short examples/` clean after commit (no stray runtime files).

## Where this is built

Per this repo's local process rules (`CLAUDE.local.md`): this is
multi-file, multi-step work, so it's built in an isolated git worktree.
Merge into `main` requires explicit user authorization — not assumed once
the worktree's work looks complete.

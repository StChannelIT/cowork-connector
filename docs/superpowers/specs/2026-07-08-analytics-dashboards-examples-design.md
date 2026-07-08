# Analytics dashboards — before/after connector examples

Date: 2026-07-08

## Goal

Add two new illustrative examples to `examples/` showing how a real web
dashboard changes when the Cowork Connector is integrated into it:

1. **Market/Crypto Trend dashboard** — launches trend/sentiment analyses on a
   crypto ticker or a social keyword/topic.
2. **SEO/GEO Audit dashboard** — launches a lightweight SEO + AI-citability
   audit on a domain.

For each, two **separate, standalone** example folders are created:

- a **"before"** version: the dashboard as it would typically be built
  *without* the connector — the UI calls a paid AI API directly (placeholder
  key, illustrative only, not meant to run against a real key).
- an **"after"** version: the same UI, but the analysis now goes through the
  Cowork Connector's remote queue (a **copy** of `core/tasks.php`, deployed
  standalone for this example) instead of a direct paid API call.

Keeping "before" and "after" as separate folders (not nested) lets each be
shown/deployed on its own when demonstrating "here's the plain dashboard" vs
"here's the same dashboard with the connector wired in".

## Non-goals

- No changes to any existing file (`core/tasks.php`, `core/runner_remote.py`,
  `CLAUDE.md`, `README.md`, `cowork_domains.json`, etc.). Everything is new
  files under `examples/`.
- No new server-side actions: both dashboards close their jobs with the
  `complete` action that `core/tasks.php` already implements.
- No real paid-API integration in the "before" examples — they show the
  *shape* of a typical direct-API call (fetch, placeholder key, sync
  response), not a working integration.
- No user auth / multi-tenant support (single-user tool, per earlier
  discussion).
- No chart library / rich visualization in v1 — numeric highlights are shown
  as simple stat tiles from the `meta` JSON; the narrative report is rendered
  from `result_md`. Charts are an explicit future extension, not built now.

## Folder layout

```
examples/
  market-trend-dashboard-before/
    index.html
    app.js
    README.md

  market-trend-dashboard-after/
    index.html
    app.js
    tasks.php                   (copy of core/tasks.php, own DB/token)
    CLAUDE-addendum.md
    domain-config-snippet.json
    README.md

  seo-geo-dashboard-before/
    index.html
    app.js
    README.md

  seo-geo-dashboard-after/
    index.html
    app.js
    tasks.php                   (copy of core/tasks.php, own DB/token)
    CLAUDE-addendum.md
    domain-config-snippet.json
    README.md
```

Each `README.md` explains: what the example demonstrates, how it relates to
its before/after counterpart, and how to run it locally (`php -S
localhost:8000` in the `-after` folder) then deploy online (upload the same
files, change `AUTH_TOKEN`/`DB_FILE` in `tasks.php`, point `app.js` at the
real URL).

## "before" dashboards (no connector)

Single static page per topic:

- A form: target input (ticker/keyword for market-trend; domain + optional
  keyword for seo-geo) + "Analizza" button.
- On submit: `app.js` does a **synchronous fetch directly to a placeholder
  paid AI endpoint** (e.g. `https://api.example.com/v1/chat/completions`,
  `Authorization: Bearer YOUR_API_KEY_HERE`), sending a prompt built from the
  form fields, and renders the response text in a result panel once it comes
  back.
- No job list/history — a direct call has no "pending" state to track.
- Clearly commented as illustrative: the endpoint/key are placeholders, not
  wired to a real provider. Purpose is to show the familiar "give it your
  API key" pattern this repo's introduction (`CLAUDE.md` §0) describes.

## "after" dashboards (connector-integrated)

Same form UI, but:

1. On submit, `app.js` calls the bundled `tasks.php` copy: `POST
   ?action=add` with `action_type` = `market_trend` or `seo_geo_audit`, a
   `prompt` built from the form fields, and `params` holding the structured
   target (ticker/keyword or domain/keyword).
2. A job list polls `?action=recent` (or `?action=list`) every few seconds,
   showing status (`pending`/`running`/`done`/`error`) per submitted job.
3. Clicking a job calls `?action=status&id=<id>` and renders `result_md`
   (markdown) plus any numeric fields from `meta` as stat tiles.
4. Auth: on first load the page asks for the API URL + token, stored in
   `localStorage`, sent as `X-Auth-Token` on every request. Not embedded in
   the shipped files.

`tasks.php` here is a **copy** of `core/tasks.php` (same schema/actions,
untouched core file), with its own `DB_FILE`/`AUTH_TOKEN` placeholders to
fill in per deployment — same pattern as
`examples/editorial-content-automation/sources.php`.

### `market_trend` execution (documented in `CLAUDE-addendum.md`)

- Target: crypto ticker or social keyword/topic.
- Use the LunarCrush MCP tools already available in session
  (`cryptocurrencies`/`topic`/`topic_posts`/`creator` as fits the target) to
  gather price/social-volume/sentiment/top-posts.
- Produce `result_md`: short Italian report (sintesi + metriche + 2-3
  highlight).
- Produce `meta`: numeric fields for stat tiles (e.g. `score`, `sentiment`,
  `social_volume`, `price_change_24h` when applicable).
- Close with plain `complete` (existing action, no server change).

### `seo_geo_audit` execution (documented in `CLAUDE-addendum.md`)

- Target: domain (+ optional focus keyword).
- Run a lightweight audit using the `seo-technical` + `seo-content` +
  `geo-citability` skills (not the heavier multi-agent `geo-audit`
  orchestration, to fit one scheduled cycle).
- Produce `result_md`: composite score + top 3-5 findings, in Italian.
- Produce `meta`: sub-scores (technical, content, ai-citability) for stat
  tiles.
- Close with plain `complete`.

## Testing flow

1. Local: `cd examples/<name>-after && php -S localhost:8000`, open
   `index.html`, point the page's URL field at `http://localhost:8000`.
   Requires local PHP with `pdo_sqlite` (not assumed present — README notes
   this as a prerequisite, with "deploy straight online" as the fallback if
   PHP isn't available locally).
2. Online: upload the same `-after` folder's files to a PHP host, edit
   `AUTH_TOKEN`/`DB_FILE` in the uploaded `tasks.php` copy, point `app.js`'s
   stored URL at the real address.
3. Job execution itself (the actual LunarCrush/SEO analysis) happens in a
   scheduled Cowork session, per the connector's existing Phase 4 pattern —
   setting up that schedule is a follow-up step for the user, not part of
   this example's file deliverables.

## Out of scope / future extensions

- Real chart rendering from `meta` time-series data.
- Turning this into an actual `connections/<name>/` entry with `NOTES.md` —
  left to the user when they decide to run one of these for real.
- Any additional `action_type`s beyond the two described here.

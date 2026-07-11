# Changelog

*[🇮🇹 Versione italiana](CHANGELOG.it.md)*

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning per [Semantic Versioning](https://semver.org/):
`MAJOR.MINOR.PATCH` — MAJOR for breaking changes (e.g. changed payload
formats or CLI commands), MINOR for backward-compatible new features, PATCH
for fixes.

To tag a release after committing locally:
```
git tag -a v0.4.0 -m "v0.4.0"
git push origin v0.4.0
```

## [0.4.0] — 2026-07-12

### Added
- `deploy_access.json` / `config/deploy_access.example.json` — optional,
  out-of-git config for FTP/SFTP server access, used only when the wizard
  uploads/updates `tasks.php` directly and the user asked Claude to persist
  that access for future updates instead of asking fresh each time.

### Changed
- `CLAUDE.md`/`CLAUDE.it.md`, Phase 2 (remote backend setup):
  - Made explicit that the remote queue is the same SQLite engine as the
    local one — `tasks.php` auto-creates `cowork_tasks.db` next to itself,
    nothing to provision by hand.
  - Added a non-technical-user path: when the user can't answer PHP/hosting
    questions, offer local-project access or FTP/SFTP credentials instead of
    asking them to guess.
  - Added guidance for FTP/SFTP connection issues: identify the hosting
    provider and guide the user through the specific fix needed (documented
    case: Aruba requires IP whitelisting in its panel before FTP connects).
  - Added a minimal diagnostic-script procedure (PHP version + available PDO
    drivers, not a full `phpinfo()`) to verify `pdo_sqlite` availability
    without asking the user, with a rule against silently switching
    `tasks.php` to a different DB engine.
  - Added explicit security handling for FTP/SFTP credentials: no default
    persistence, SFTP preferred over FTP, secrets never written to
    `connections/<name>/NOTES.md`.
  - Phase 3: added a requirement that every connection give its actual end
    user a visual way to see their result — either queryable in the
    Cowork/Claude chat, or a dashboard/page whose link is handed to the
    user — instead of leaving a task simply `done` in the DB with no way
    for the site's own user to see it.
- `.gitignore`: added `deploy_access.json`.

## [0.3.0] — 2026-07-12

### Added
- Per-site/target analysis registry in the `market-trend-dashboard-after`
  and `seo-geo-dashboard-after` examples: a "Registro" section groups every
  past job by target (crypto ticker/keyword) or domain, showing run count,
  latest score/grade, and trend vs. the previous run — the visible,
  persistent record of repeated connector usage that a synchronous direct
  API call can never provide.

### Changed
- `market-trend-dashboard-{before,after}` and `seo-geo-dashboard-{before,after}`
  redesigned with distinct, subject-grounded visual identities instead of
  bare unstyled forms: a "financial terminal" look (dark, amber ticker
  strip, monospace numerics, SVG trend chart) for market-trend, and an
  "inspection report" look (dark, blue accent, A–F letter-grade placard,
  inspection bars, findings checklist) for seo-geo. The "-after" dashboards
  now ship demo data (done/running/error states) shown until a real token
  and real jobs are available, so the dashboards are never empty on
  screenshot/video.

### Removed
- `examples/editorial-content-automation/` — superseded by the dashboard
  examples as the repo's primary reference case. References in
  `CLAUDE.md`/`CLAUDE.it.md` and `README.md`/`README.it.md` now point to
  `examples/market-trend-dashboard-after/` and
  `examples/seo-geo-dashboard-after/` instead.

## [0.2.1] — 2026-07-09

### Changed
- `.gitignore` now also excludes `CLAUDE.local.md` (local, non-shared
  process instructions for Claude Code — commit/versioning conventions,
  not part of the public project docs).

## [0.2.0] — 2026-07-09

### Added
- `examples/market-trend-dashboard-before/` and `examples/market-trend-dashboard-after/`
  — a before/after pair of standalone dashboard examples: the "before"
  calls a placeholder paid AI API directly for a crypto/social trend
  analysis, the "after" is wired to the Cowork Connector's remote queue
  instead (`market_trend` action type).
- `examples/seo-geo-dashboard-before/` and `examples/seo-geo-dashboard-after/`
  — the same before/after pattern for a SEO + AI-citability domain audit
  (`seo_geo_audit` action type).

### Changed
- English is now the default language across the top-level docs
  (`README.md`, `CLAUDE.md`, `CHANGELOG.md`, `connections/README.md`,
  `config/cowork_domains.example.json`) and the
  `examples/editorial-content-automation/` example, with `.it` siblings
  added for the original Italian versions.
- `core/tasks.php` comments and messages translated to English (no
  change to its API/behavior).

## [0.1.0] — 2026-07-07

First public release.

### Added
- `core/tasks.php` — generic PHP+SQLite engine for the **remote** queue:
  `next`, `add`, `complete`, `derive_complete`, `voice_complete`,
  `asset_complete`, `cover`, `ingest`, `fail`, `stats`, `status`, `recent`.
- `core/runner_remote.py` — CLI client for the remote backend.
- `core/runner_local.py` — client for the **local** queue (SQLite, zero
  deploy), for connections that don't require an external server.
- `CLAUDE.md` — 4-phase connection wizard (project linking,
  choosing/creating the queue backend, defining the tasks, token-efficient
  scheduled task) + detailed protocol.
- `config/cowork_domains.example.json` — configuration schema for remote
  connections.
- `connections/` — convention for the files dedicated to each active
  connection (`NOTES.md`, `queue.db`).
- `examples/editorial-content-automation/` — a real, complete use case
  (editorial automation) as a reference, anonymized.
- `LICENSE` (MIT).

### Notes
- The repo doesn't yet contain a unified CLI: the two backends
  (local/remote) have separate clients (`runner_local.py` /
  `runner_remote.py`) with similar but not identical commands — see
  `CLAUDE.md` for when to use one or the other.

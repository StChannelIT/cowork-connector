# Changelog

*[🇮🇹 Versione italiana](CHANGELOG.it.md)*

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning per [Semantic Versioning](https://semver.org/):
`MAJOR.MINOR.PATCH` — MAJOR for breaking changes (e.g. changed payload
formats or CLI commands), MINOR for backward-compatible new features, PATCH
for fixes.

To tag a release after committing locally:
```
git tag -a v0.2.0 -m "v0.2.0"
git push origin v0.2.0
```

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

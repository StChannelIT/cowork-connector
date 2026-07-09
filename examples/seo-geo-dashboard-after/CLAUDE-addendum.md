# CLAUDE.md addendum — SEO/GEO audit dashboard (example)

Paste/summarize into your project's `CLAUDE.md` if you deploy this
dashboard for real. Assumes the generic protocol in this repo's `CLAUDE.md`
(remote backend, section 4) and the domain config in
`domain-config-snippet.json`.

---

## `seo_geo_audit` flow → lightweight SEO + AI-citability audit

The task's `params` holds `{ "domain": "<domain>", "keyword": "<optional>" }`
(also repeated in the `prompt`).

1. **Run the audit**: use the `seo-technical`, `seo-content` and
   `geo-citability` skills on `domain` (and `keyword` if given) — not the
   heavier multi-agent `geo-audit` orchestration, to keep this inside one
   scheduled cycle.
2. **Write `result_md`**: composite assessment in Italian — overall
   impression + the 3-5 most important findings, each with a one-line fix.
3. **Write `meta`**: sub-scores for the dashboard's detail view, e.g.:
   ```json
   { "score_technical": 68, "score_content": 74, "score_ai_citability": 55 }
   ```
4. **Close**:
   ```
   python core/runner_remote.py complete --id <ID> --payload payload.json --domain <this-domain>
   ```
   ```json
   { "id": <ID>, "result_md": "<report>", "meta": { "...": "..." } }
   ```

No new server action: this closes with the same `complete` action used for
`generate`/`revise` tasks (see main `CLAUDE.md` §4.1).

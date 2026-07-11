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
   impression + priorities. The dashboard renders this with a minimal
   markdown parser that only understands `## heading` and `- bullet`
   lines, so stick to those two constructs (no tables, no nested lists, no
   inline `**bold**`).
3. **Write `meta`**: sub-scores plus the domain and a structured findings
   list, e.g.:
   ```json
   {
     "domain": "esempio.com",
     "score_technical": 68,
     "score_content": 74,
     "score_ai_citability": 55,
     "findings": [
       { "severity": "fail", "text": "Manca il file llms.txt." },
       { "severity": "warn", "text": "Meta description assente su 6 pagine su 10." },
       { "severity": "pass", "text": "Robots.txt corretto." }
     ]
   }
   ```
   - `domain` is required — the dashboard uses it as the job's display name
     (status strip, detail title) **and** as the grouping key for the
     "Registro per sito" section, which aggregates every past audit of the
     same `domain` into a run count, latest grade, and trend vs. the
     previous audit. Always write the bare domain the same way across
     repeated runs (e.g. always `"esempio.com"`, not `"esempio.com"` once
     and `"www.esempio.com"` another time) or the dashboard will treat them
     as two different sites.
   - `score_technical`/`score_content`/`score_ai_citability` (0-100) drive
     the inspection bars and the overall A–F grade placard (average of the
     three, rounded).
   - `findings`: 3-5 entries, `severity` is one of `pass`/`warn`/`fail`,
     `text` is a single-sentence finding — powers the checklist under the
     grade placard. Order by severity (fail/warn first) for a readable list.
4. **Close**:
   ```
   python core/runner_remote.py complete --id <ID> --payload payload.json --domain <this-domain>
   ```
   ```json
   { "id": <ID>, "result_md": "<report>", "meta": { "...": "..." } }
   ```

No new server action: this closes with the same `complete` action used for
`generate`/`revise` tasks (see main `CLAUDE.md` §4.1).

# CLAUDE.md addendum — market trend dashboard (example)

Paste/summarize into your project's `CLAUDE.md` if you deploy this
dashboard for real. Assumes the generic protocol in this repo's `CLAUDE.md`
(remote backend, section 4) and the domain config in
`domain-config-snippet.json`.

---

## `market_trend` flow → crypto/social trend analysis

The task's `params` holds `{ "target": "<ticker or keyword>" }` (also
repeated in the `prompt`, so both are usable).

1. **Gather data**: if `target` looks like a crypto ticker, use the
   LunarCrush MCP tools for cryptocurrencies (price, social volume,
   sentiment, Galaxy Score); if it's a generic keyword/topic, use the
   LunarCrush topic/creator tools instead (interactions, sentiment, top
   posts).
2. **Write `result_md`**: a short report in Italian — synthesis, sentiment,
   3-5 key metrics, 2-3 highlighted posts/creators if relevant.
3. **Write `meta`**: flat numeric fields the dashboard renders as a
   detail list, e.g.:
   ```json
   { "score": 72, "sentiment": "positivo", "social_volume": 18400, "price_change_24h": 3.2 }
   ```
   Only include the fields that make sense for the target (crypto tickers
   get `price_change_24h`, generic keywords may not).
4. **Close**:
   ```
   python core/runner_remote.py complete --id <ID> --payload payload.json --domain <this-domain>
   ```
   ```json
   { "id": <ID>, "result_md": "<report>", "meta": { "...": "..." } }
   ```

No new server action: this closes with the same `complete` action used for
`generate`/`revise` tasks (see main `CLAUDE.md` §4.1).

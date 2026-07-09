# Example: editorial content automation

*[🇮🇹 Versione italiana](README.it.md)*

A real use case built on top of `core/tasks.php` + `core/runner_remote.py`,
with no changes to the generic engine (it only uses the actions the engine
already provides: `complete`, `derive_complete`, `voice_complete`,
`asset_complete`, `cover`, `ingest`).

What it does: from a topic/source, it produces an article draft, a cover
generated with an image model, ready-to-publish multi-platform social posts,
and maintains a "voice profile" over time to stay consistent in tone. It also
includes a small registry of "sources to monitor" (blogs, channels,
creators) as an example of how to extend the engine with a table/action of
your own.

> Every value in here is **anonymized/example data** (domain `example.com`,
> placeholder token, fake UUIDs). It isn't ready to use as-is — it's a
> reference to adapt, not a plugin to install.

## Files

| File | Role |
|---|---|
| `CLAUDE-addendum.md` | Extends `CLAUDE.md` with the detailed routing for `generate`/`revise`/`scout`/`derive`/`der_revise`/`voice`/`asset` applied to an editorial flow. Paste it (or link it) into your project's `CLAUDE.md` if you want to replicate this case. |
| `domain-config-snippet.json` | The block to insert into your `cowork_domains.json` for this domain (`content`, `social`, `cover`, `publish.defaults` sections). |
| `add_caption.py` | Pillow script that overlays a title/subtitle onto a generated cover image, with a readable gradient. |
| `radar_sources.py` | CLI client for a registry of sources (blogs/creators/channels to monitor) — reads/writes via `sources.php`. |
| `sources.php` | A small additional API route (same token pattern as `core/tasks.php`) for the sources registry. Optional: only needed if you also want source monitoring, not for generate/derive/voice/asset. |

## How it fits into the generic engine

- `generate`/`revise` tasks produce `result_md` + `meta` (title, tags, cover
  prompt, etc.) → closed with `complete`, exactly like any other domain.
- The generated cover (with an image model of your choice) is **first**
  refined with `add_caption.py` (adds readable text with a gradient) and
  **then** delivered with
  `python core/runner_remote.py cover --draft-id N --file captioned_cover.jpg`.
- Social posts are generated together with the article and tucked into
  `meta` (a free-form key, e.g. `meta.social_text`) inside the same
  `complete` — no dedicated server action: it's a domain convention, not an
  engine one.
- The "voice profile" (tone guidelines that get refined over time) uses
  `action_type: voice` → closed with `voice-complete`, which saves it as a
  persistent profile re-read on every subsequent `generate` (the task's
  `prompt` already includes it, generated client-side before queuing — see
  the addendum).
- Social derivatives from an already-published article (`action_type:
  derive` / `der_revise`) use `derive-complete`.

## Why it isn't "ready to use"

The image generator, the destination CMS details, the number of social
platforms, and the tone rules are specific to the original project. Take
this folder as a **map** of what needs to be decided for a complete
editorial automation, not as a plug-and-play package.

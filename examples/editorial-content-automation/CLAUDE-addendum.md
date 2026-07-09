# CLAUDE.md addendum — editorial domain (example)

*[🇮🇹 Versione italiana](CLAUDE-addendum.it.md)*

To paste/summarize into your project's `CLAUDE.md` if you're replicating
this use case. Assumes you've already read `CLAUDE.md` (generic protocol)
and the domain config in `domain-config-snippet.json`.

---

## `generate` / `revise` flow → article + social + cover

1. **Article**: write the markdown following `{content.language}`,
   `{content.tone}`, step-based structure with `##` headings. If
   `{content.no_frontmatter}` = true, no YAML frontmatter.
2. **Social posts** (if `{social.enabled}`): for each platform in
   `{social.platforms}`, a ready-to-publish post, respecting that platform's
   tone/length/hashtags. Use `{social.link_placeholder}` in place of the
   article's URL (not yet known). Pack it according to `{social.format}`
   into the `{social.deliver_in}` key of `meta`.
3. **Cover**: generate an image with the model given in
   `{cover.image_model}`, following `{cover.instructions}`; use
   `<<<{cover.element_id}>>>` as a placeholder for the subject (never as
   literal text in the prompt); append `{cover.image_style}`. Don't put any
   text in the image prompt.
4. **Caption**: add a title/subtitle with the support script:
   ```
   python add_caption.py <image_url_or_path> "<title>" "<subtitle>" <output_folder/> {cover.zone}
   ```
   Visual parameters come from `{cover.gradient}` and `{cover.text}`.
5. **Close with `complete`**:
   ```json
   {
     "id": <task_id>,
     "result_md": "<markdown WITHOUT frontmatter>",
     "meta": {
       "title": "...", "description": "...", "tags": [...],
       "cover_prompt": "...", "cover_image": "<generator's raw url, for reference>",
       "social_text": "<posts packed per social.format>"
     }
   }
   ```
   Also include the `{publish.defaults}` keys inside `meta` if present —
   they're the publishing defaults the user later reviews by hand.
6. **Deliver the cover** with
   `python core/runner_remote.py cover --draft-id <task_id> --file <captioned.jpg>`.
   ⚠️ ALWAYS deliver the file **with the caption already applied** by
   `add_caption.py`, never the generator's raw image — otherwise it arrives
   with no readable text. If the JPEG exceeds `{cover.delivery.max_bytes}`,
   recompress by trying `{cover.delivery.jpeg_quality_steps}` in sequence.

`revise_policy`: if the draft already has a cover and the instruction
doesn't explicitly ask to change it, don't regenerate it — limit the change
to text/meta/social.

---

## `derive` / `der_revise` flow → social post from an already-published article

The task's `prompt` is self-sufficient: it contains the voice profile, the
source article, the requested format (`content_json`), and the `id`/
`derivative_id` to use when closing it.

1. Write the native script for the target platform (not a flat summary).
2. Prepare `content_md` (readable, no frontmatter) and `content_json` (the
   requested structure, e.g. `{caption, hashtags, cta}`).
3. Close:
   ```
   python core/runner_remote.py derive-complete --id <id> --der-id <derivative_id> --payload payload.json
   ```

---

## `voice` flow → voice profile

Generate/update an editorial profile (tone, vocabulary to use/avoid,
preferred structure, examples, do & don't), in markdown, consistent with the
examples/feedback received.

```
python core/runner_remote.py voice-complete --id <id> --scope global --mode seed --payload payload.json
```
```json
{ "id": <id>, "scope": "global", "mode": "seed", "profile_md": "<profile in markdown>" }
```

Subsequent `generate` tasks will use it automatically if the `prompt`
includes it (this must be fetched client-side, e.g. by a script of yours
that composes the prompt before queuing it with `add`).

---

## `asset` flow → real images/video from an approved script

Generate the assets (same model/placeholder as the cover step) and close
with:
```
python core/runner_remote.py asset-complete --id <id> --der-id <derivative_id> --payload payload.json
```

---

## `scout` flow → candidates for the editorial team

Search for topics/sources according to the `prompt`, then:
```json
{
  "job_id": <id>,
  "candidates": [
    { "source_title": "...", "source_url": "...", "topic": "...", "score": 0-100,
      "score_reason": "...", "angle": "editorial angle", "target": "tutorial|blog" }
  ]
}
```
closed with `ingest` (see the main `CLAUDE.md`, section 3.2).

---

## Registry of sources to monitor (optional)

If you use `sources.php` + `radar_sources.py`:
```
python radar_sources.py list                       # list of sources
python radar_sources.py list --active --tag ai-video
python radar_sources.py ingest sources_payload.json # upsert, dedup on "name"
```
Group ALL references (blog + social channels) of the same
person/brand under a single `name`; the upsert updates the fields, merges
the `tags`, and only adds new `refs`.

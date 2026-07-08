# Addendum CLAUDE.md — dominio editoriale (esempio)

Da incollare/riassumere nel `CLAUDE.md` del tuo progetto se replichi questo caso
d'uso. Presuppone che tu abbia già letto `CLAUDE.md` (protocollo generico) e la
config di dominio in `domain-config-snippet.json`.

---

## Flusso `generate` / `revise` → articolo + social + cover

1. **Articolo**: scrivi il markdown secondo `{content.language}`, `{content.tone}`,
   struttura a step con `##`. Se `{content.no_frontmatter}` = true, niente
   frontmatter YAML.
2. **Post social** (se `{social.enabled}`): per ogni piattaforma in
   `{social.platforms}`, un post pronto da pubblicare, rispettando tono/lunghezza/
   hashtag di quella piattaforma. Usa `{social.link_placeholder}` al posto dell'URL
   dell'articolo (non ancora noto). Impacchetta secondo `{social.format}` nella
   chiave `{social.deliver_in}` del `meta`.
3. **Cover**: genera un'immagine col modello indicato in `{cover.image_model}`,
   seguendo `{cover.instructions}`; usa `<<<{cover.element_id}>>>` come placeholder
   del soggetto (mai come testo letterale nel prompt); appendi `{cover.image_style}`.
   Non inserire testo nel prompt immagine.
4. **Caption**: aggiungi titolo/sottotitolo con lo script di supporto:
   ```
   python add_caption.py <url_o_percorso_immagine> "<titolo>" "<sottotitolo>" <cartella_output/> {cover.zone}
   ```
   Parametri visivi da `{cover.gradient}` e `{cover.text}`.
5. **Chiudi con `complete`**:
   ```json
   {
     "id": <task_id>,
     "result_md": "<markdown SENZA frontmatter>",
     "meta": {
       "title": "...", "description": "...", "tags": [...],
       "cover_prompt": "...", "cover_image": "<url raw del generatore, riferimento>",
       "social_text": "<post impacchettati come da social.format>"
     }
   }
   ```
   Includi anche le chiavi di `{publish.defaults}` dentro `meta` se presenti — sono
   i default di pubblicazione che l'utente poi rivede a mano.
6. **Consegna la cover** con `python core/runner_remote.py cover --draft-id <task_id> --file <captioned.jpg>`.
   ⚠️ Consegna SEMPRE il file **con la caption già applicata** da `add_caption.py`,
   mai l'immagine grezza del generatore — altrimenti arriva senza testo leggibile.
   Se il JPEG supera `{cover.delivery.max_bytes}`, ricomprimi provando in sequenza
   `{cover.delivery.jpeg_quality_steps}`.

`revise_policy`: se la bozza ha già una cover e l'istruzione non chiede
esplicitamente di cambiarla, non rigenerarla — limita l'intervento a testo/meta/social.

---

## Flusso `derive` / `der_revise` → post social da un articolo già pubblicato

Il `prompt` del task è autosufficiente: contiene il profilo di voce, l'articolo
sorgente, il formato richiesto (`content_json`) e `id`/`derivative_id` da usare in
chiusura.

1. Scrivi lo script nativo per la piattaforma target (non un riassunto piatto).
2. Prepara `content_md` (leggibile, senza frontmatter) e `content_json` (struttura
   richiesta, es. `{caption, hashtags, cta}`).
3. Chiudi:
   ```
   python core/runner_remote.py derive-complete --id <id> --der-id <derivative_id> --payload payload.json
   ```

---

## Flusso `voice` → diario di voce

Genera/aggiorna un profilo editoriale (tono, lessico da usare/evitare, struttura
preferita, esempi, do & don't), in markdown, coerente con esempi/feedback ricevuti.

```
python core/runner_remote.py voice-complete --id <id> --scope global --mode seed --payload payload.json
```
```json
{ "id": <id>, "scope": "global", "mode": "seed", "profile_md": "<diario in markdown>" }
```

I task `generate` successivi lo useranno automaticamente se il `prompt` lo include
(va recuperato lato client, es. da un tuo script che compone il prompt prima di
mandarlo in coda con `add`).

---

## Flusso `asset` → immagini/video reali da uno script approvato

Genera gli asset (stesso modello/placeholder del passo cover) e chiudi con:
```
python core/runner_remote.py asset-complete --id <id> --der-id <derivative_id> --payload payload.json
```

---

## Flusso `scout` → candidati per la redazione

Cerca argomenti/fonti secondo il `prompt`, poi:
```json
{
  "job_id": <id>,
  "candidates": [
    { "source_title": "...", "source_url": "...", "topic": "...", "score": 0-100,
      "score_reason": "...", "angle": "angolo editoriale", "target": "tutorial|blog" }
  ]
}
```
chiuso con `ingest` (vedi `CLAUDE.md` principale, sezione 3.2).

---

## Anagrafica sorgenti da monitorare (facoltativo)

Se usi `sources.php` + `radar_sources.py`:
```
python radar_sources.py list                       # elenco sorgenti
python radar_sources.py list --active --tag ai-video
python radar_sources.py ingest sources_payload.json # upsert, dedup su "name"
```
Raggruppa TUTTI i riferimenti (blog + canali social) della stessa persona/brand
sotto un unico `name`; l'upsert aggiorna i campi, unisce i `tags` e aggiunge solo i
`refs` nuovi.

# Esempio: automazione editoriale

Caso d'uso reale costruito sopra `core/tasks.php` + `core/runner_remote.py`, senza
modifiche al motore generico (usa solo le azioni già previste: `complete`,
`derive_complete`, `voice_complete`, `asset_complete`, `cover`, `ingest`).

Cosa fa: da un argomento/fonte, produce una bozza di articolo, una cover generata
con un modello immagine, dei post social multi-piattaforma pronti da pubblicare, e
mantiene nel tempo un "diario di voce" per restare coerente nel tono. Include anche
un piccolo registro di "sorgenti da monitorare" (blog, canali, creator) come esempio
di come estendere il motore con una tabella/azione tua.

> Tutti i valori qui dentro sono **anonimizzati/di esempio** (dominio `esempio.com`,
> token placeholder, UUID fittizi). Non è pronto all'uso — è un riferimento da
> adattare, non un plugin da installare.

## File

| File | Ruolo |
|---|---|
| `CLAUDE-addendum.md` | Estende `CLAUDE.md` con il routing dettagliato per `generate`/`revise`/`scout`/`derive`/`der_revise`/`voice`/`asset` applicato a un flusso editoriale. Incollalo (o linkalo) nel tuo `CLAUDE.md` di progetto se vuoi replicare questo caso. |
| `domain-config-snippet.json` | Il blocco da inserire nel tuo `cowork_domains.json` per questo dominio (sezioni `content`, `social`, `cover`, `publish.defaults`). |
| `add_caption.py` | Script Pillow per sovrapporre titolo/sottotitolo a un'immagine di cover generata, con gradiente leggibile. |
| `radar_sources.py` | Client CLI per un'anagrafica sorgenti (blog/creator/canali da monitorare) — legge/scrive via `sources.php`. |
| `sources.php` | Piccola rotta API aggiuntiva (stesso pattern token di `core/tasks.php`) per l'anagrafica sorgenti. Facoltativa: serve solo se vuoi anche il monitoraggio fonti, non per generate/derive/voice/asset. |

## Come si incastra col motore generico

- I task `generate`/`revise` producono `result_md` + `meta` (titolo, tag, prompt
  cover, ecc.) → chiusi con `complete`, esattamente come qualunque altro dominio.
- La cover generata (con un modello immagine a tua scelta) viene **prima** rifinita
  con `add_caption.py` (aggiunge testo leggibile con gradiente) e **poi** consegnata
  con `python core/runner_remote.py cover --draft-id N --file cover_captionata.jpg`.
- I post social sono generati insieme all'articolo e infilati in `meta` (chiave
  libera, es. `meta.social_text`) dentro lo stesso `complete` — nessuna azione
  server dedicata: è una convenzione del dominio, non del motore.
- Il "diario di voce" (linee guida di tono che si affinano nel tempo) usa
  `action_type: voice` → chiuso con `voice-complete`, che lo salva come profilo
  persistente riletto ad ogni `generate` successivo (il `prompt` del task lo include
  già, generato lato client prima di mettere in coda — vedi addendum).
- Le derivazioni social da un articolo già pubblicato (`action_type: derive` /
  `der_revise`) usano `derive-complete`.

## Perché non è "pronto all'uso"

Il generatore immagini, i dettagli del CMS di destinazione, il numero di
piattaforme social e le regole di tono sono specifici del progetto originale.
Prendi questa cartella come **mappa** di cosa serve decidere per un'automazione
editoriale completa, non come pacchetto plug-and-play.

# Changelog

*[🇬🇧 English version](CHANGELOG.md)*

Formato basato su [Keep a Changelog](https://keepachangelog.com/it/1.1.0/),
versioning secondo [Semantic Versioning](https://semver.org/lang/it/):
`MAJOR.MINOR.PATCH` — MAJOR per cambi che rompono compatibilità (es. formati di
payload o comandi CLI cambiati), MINOR per nuove funzionalità retrocompatibili,
PATCH per correzioni.

Per taggare una release dopo aver fatto commit in locale:
```
git tag -a v0.3.0 -m "v0.3.0"
git push origin v0.3.0
```

## [0.3.0] — 2026-07-12

### Aggiunto
- Registro delle analisi per sito/target negli esempi
  `market-trend-dashboard-after` e `seo-geo-dashboard-after`: una sezione
  "Registro" raggruppa ogni job passato per target (ticker crypto/parola
  chiave) o dominio, mostrando numero di analisi, ultimo punteggio/voto e
  trend rispetto all'analisi precedente — la prova visibile e persistente
  dell'uso ripetuto del connettore, cosa che una chiamata API diretta e
  sincrona non può mai offrire.

### Modificato
- `market-trend-dashboard-{before,after}` e `seo-geo-dashboard-{before,after}`
  ridisegnate con identità visive distinte e legate al soggetto, al posto
  di form spoglie e non stilizzate: uno stile "terminale finanziario"
  (scuro, ticker ambra, numeri in monospace, grafico SVG dell'andamento)
  per market-trend, e uno stile "report di ispezione" (scuro, accento blu,
  placard con voto A–F, barre di ispezione, checklist di rilievi) per
  seo-geo. Le dashboard "-dopo" ora mostrano dati di esempio (stati
  done/running/error) finché non sono disponibili un token e job reali,
  così non sono mai vuote in uno screenshot/video.

### Rimosso
- `examples/editorial-content-automation/` — sostituito dalle dashboard
  come caso di riferimento principale del repo. I riferimenti in
  `CLAUDE.md`/`CLAUDE.it.md` e `README.md`/`README.it.md` ora puntano a
  `examples/market-trend-dashboard-after/` e
  `examples/seo-geo-dashboard-after/`.

## [0.2.1] — 2026-07-09

### Modificato
- `.gitignore` ora esclude anche `CLAUDE.local.md` (istruzioni di processo
  locali e non condivise per Claude Code — convenzioni di commit/versioning,
  non parte della documentazione pubblica del progetto).

## [0.2.0] — 2026-07-09

### Aggiunto
- `examples/market-trend-dashboard-before/` e `examples/market-trend-dashboard-after/`
  — una coppia di esempi dashboard prima/dopo: la versione "prima" chiama
  direttamente un'API AI a pagamento (segnaposto) per un'analisi di trend
  crypto/social, la versione "dopo" usa invece la coda remota del Cowork
  Connector (`action_type` `market_trend`).
- `examples/seo-geo-dashboard-before/` e `examples/seo-geo-dashboard-after/`
  — stesso schema prima/dopo per un audit SEO + citabilità AI di un dominio
  (`action_type` `seo_geo_audit`).

### Modificato
- L'inglese è ora la lingua di default nei documenti principali
  (`README.md`, `CLAUDE.md`, `CHANGELOG.md`, `connections/README.md`,
  `config/cowork_domains.example.json`) e nell'esempio
  `examples/editorial-content-automation/`, con versioni `.it` gemelle per
  gli originali italiani.
- Commenti e messaggi di `core/tasks.php` tradotti in inglese (nessun
  cambio all'API/comportamento).

## [0.1.0] — 2026-07-07

Prima versione pubblica.

### Aggiunto
- `core/tasks.php` — motore generico PHP+SQLite per coda **remota**: `next`,
  `add`, `complete`, `derive_complete`, `voice_complete`, `asset_complete`,
  `cover`, `ingest`, `fail`, `stats`, `status`, `recent`.
- `core/runner_remote.py` — client CLI per il backend remoto.
- `core/runner_local.py` — client per coda **locale** (SQLite, zero deploy),
  per connessioni che non richiedono un server esterno.
- `CLAUDE.md` — wizard di connessione a 4 fasi (collegamento al progetto,
  scelta/creazione del backend coda, definizione delle attività, task
  schedulato token-efficiente) + protocollo di dettaglio.
- `config/cowork_domains.example.json` — schema di configurazione per le
  connessioni remote.
- `connections/` — convenzione per i file dedicati a ogni connessione attiva
  (`NOTES.md`, `queue.db`).
- `examples/editorial-content-automation/` — caso d'uso reale e completo
  (automazione editoriale) come riferimento, anonimizzato.
- `LICENSE` (MIT).

### Note
- Il repo non contiene ancora una CLI unificata: i due backend (locale/remoto)
  hanno client separati (`runner_local.py` / `runner_remote.py`) con comandi
  simili ma non identici — vedi `CLAUDE.md` per quando usare l'uno o l'altro.

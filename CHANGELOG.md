# Changelog

Formato basato su [Keep a Changelog](https://keepachangelog.com/it/1.1.0/),
versioning secondo [Semantic Versioning](https://semver.org/lang/it/):
`MAJOR.MINOR.PATCH` — MAJOR per cambi che rompono compatibilità (es. formati di
payload o comandi CLI cambiati), MINOR per nuove funzionalità retrocompatibili,
PATCH per correzioni.

Per taggare una release dopo aver fatto commit in locale:
```
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

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

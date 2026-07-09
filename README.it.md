# Cowork Connector

*[🇬🇧 English version](README.md)*

`v0.1.0` — vedi `CHANGELOG.md` per la cronologia delle versioni.

Automatizzare un progetto esterno di solito significa dargli una **chiave API a
pagamento** (OpenAI, Anthropic API, ecc.) da consumare a token. Il Cowork
Connector sostituisce quella chiave: al progetto esterno dai un endpoint (o un
file locale) su cui scrivere "cosa va fatto", e a leggerlo/eseguirlo è il tuo
**abbonamento Cowork**, già pagato, non a consumo. Una sessione Cowork
**schedulata** preleva i task in coda e li esegue con tutti gli strumenti che
Claude ha già a disposizione — file, web, skill, connettori MCP — poi riporta
l'esito.

Non è un connettore MCP: è più semplice. Una coda (locale o su un tuo server) +
un task schedulato che la legge. Zero integrazioni custom con API esterne a
pagamento, zero chiavi da gestire lato Cowork oltre a un token che tu stesso
generi.

```
Backend LOCALE (zero deploy)                  Backend REMOTO (server esterno)
──────────────────────────────                ────────────────────────────────
Tu (script locale) ──add──► queue.db           Sistema esterno ──POST add──► tasks.php ──► SQLite
                               │                (es. un sito, un form, un CMS)      │
   Cowork (schedulato) ───────►│  preleva            Cowork (schedulato) ──GET next►│  preleva
   ed esegue con i suoi                              ed esegue con i suoi
   strumenti ──complete/fail──►│                      strumenti ──complete/fail────►│
```

## Perché questo pattern

- **Il tuo abbonamento Cowork al posto delle chiavi API**: l'endpoint (URL +
  token) o il file locale della coda funge da "credenziale" ovunque un sistema
  esterno si aspetterebbe una API key — ma l'esecuzione avviene nella tua
  sessione Cowork, non a consumo di token API.
- **Nessuna integrazione custom**: metti in coda qualunque richiesta in linguaggio
  naturale, Claude la esegue con gli strumenti che ha già in sessione.
- **Disaccoppiato**: definisci un task quando vuoi (a mano, da script, da un tuo
  CMS/form); viene eseguito al ciclo schedulato successivo.
- **Tracciabile**: ogni task ha stato, log, timestamp, tentativi.
- **Robusto**: claim atomico (niente doppie esecuzioni), retry configurabili.
- **Generico**: l'`action_type` di un task è un'etichetta libera, definita per
  ogni connessione — decidi tu cosa significa "generate", "scout",
  "sync-inventario" o qualunque altra cosa ti serva.

## Due backend, scegli in base al caso

| | Backend locale | Backend remoto |
|---|---|---|
| Quando | Il lavoro è interno a Cowork (ricerche, file, contenuti) | Un sistema esterno deve poter scrivere task da solo (form, CMS, webhook) |
| Dove vive la coda | SQLite dentro il progetto (`connections/<nome>/queue.db`) | PHP + SQLite su un server esterno tuo |
| Requisiti | Nessuno oltre a Python 3 (stdlib) | Server con PHP 7.4+ e `pdo_sqlite` |
| File | `core/runner_local.py` | `core/tasks.php` + `core/runner_remote.py` |

Puoi avere più connessioni attive insieme, ognuna col backend più adatto — vedi
`connections/`.

## Requisiti

- **Claude Cowork**, con accesso a questo progetto e alla skill `schedule` per il
  task ricorrente.
- Python 3 solo libreria standard (nessun pacchetto da installare).
- Solo se usi il backend remoto per almeno una connessione: un server con PHP
  7.4+ e `pdo_sqlite` (hosting condiviso va benissimo).

## Struttura del repo

| Percorso | Ruolo |
|---|---|
| `CLAUDE.md` | Istruzioni di progetto: protocollo + **wizard di connessione a 4 fasi** (guida Claude a collegare un nuovo progetto in conversazione — non è uno script separato). |
| `core/runner_local.py` | Client per la coda **locale** (SQLite nel progetto, zero deploy). |
| `core/tasks.php` | Rotta API per la coda **remota**, da caricare sul tuo server. Crea da sé il database SQLite accanto a sé. |
| `core/runner_remote.py` | Client CLI che parla con `tasks.php`. |
| `config/cowork_domains.example.json` | Schema + esempio di configurazione per le connessioni remote. Copialo in `cowork_domains.json` (fuori da git, contiene i token). |
| `connections/` | Una cartella per ogni connessione attiva (config/note/coda locale). Vedi `connections/README.md`. |
| `examples/editorial-content-automation/` | Caso d'uso reale e completo — automazione editoriale (bozza articolo + cover generata + post social) — come riferimento per costruire il tuo. |

## Avvio rapido

1. **Clona/scarica questo repo** dentro la cartella del tuo progetto Cowork.
2. **Apri una sessione Cowork in questo progetto e dì cosa vuoi automatizzare**
   (es. "voglio collegare il mio blog per generare bozze automaticamente", oppure
   "voglio che ogni mattina mi cerchi le notizie su X"). Non c'è uno script wizard
   separato: `CLAUDE.md` istruisce Claude a farti da wizard in 4 fasi — collegamento
   al progetto desiderato, scelta/creazione della coda (locale o remota),
   definizione delle attività, task schedulato.
3. Se la connessione richiede il backend **remoto**, Claude ti guiderà a caricare
   `core/tasks.php` sul tuo server con un token generato lì per lì, e a testarlo:
   ```
   curl -H "X-Auth-Token: IL_TUO_TOKEN" "https://tuosito.it/cowork/tasks.php?action=stats"
   ```
   → deve rispondere con un JSON di conteggi (anche tutti a zero).
4. **Claude fa schedulare il ciclo** con la skill `schedule` — quanto spesso
   controllare la coda lo decidete insieme (15-30 min è un buon default), e il
   prompt schedulato segue sempre lo stesso algoritmo essenziale: controllo
   leggero → coda vuota? stop subito, senza sprecare token → coda piena? esegue
   secondo il processo concordato per quella connessione.
5. **Metti in coda il primo task**, ad esempio (backend locale):
   ```
   python core/runner_local.py add --connection <nome> \
     --prompt "Cerca le 3 notizie più rilevanti su X e scrivi un riassunto in report/news.md" \
     --action-type generate --priority 3
   ```
   Al ciclo successivo, Cowork lo preleva e lo esegue.

## Protocollo (backend remoto)

Il file `core/tasks.php` espone, tutte protette dal token (`X-Auth-Token` o `?token=`):

| Azione | Metodo | A cosa serve |
|---|---|---|
| `next` | GET | Preleva i task `pending` (claim atomico → `running`) |
| `add` | POST | Inserisce un nuovo task in coda |
| `complete` | POST | Chiude un task con esito positivo (`result_md`, `meta` liberi) |
| `derive_complete` | POST | Chiude un task che produce un "derivato" (es. un post social da un contenuto già pronto) |
| `voice_complete` | POST | Chiude un task che aggiorna un profilo/linee guida persistenti |
| `asset_complete` | POST | Chiude un task che produce asset reali (immagini/video), come file o URL |
| `cover` | POST | Consegna un'immagine di copertina legata a un task (base64 o URL) |
| `ingest` | POST | Chiude un task di tipo "ricerca candidati" con una lista di risultati |
| `fail` | POST | Segna un task come fallito (retry automatico se restano tentativi) |
| `stats` / `status` / `recent` / `list` | GET | Diagnostica e ispezione della coda |

Il backend **locale** (`core/runner_local.py`) espone lo stesso concetto in forma
minimale: `init`, `add`, `next`, `list`, `stats`, `complete`, `fail`, `reset`.

Dettagli di ogni payload in `CLAUDE.md` e nel codice commentato di `core/tasks.php`.
`action_type` è **libero**: lo definisci per ogni connessione in
`connections/<nome>/NOTES.md` durante il wizard.

## Sicurezza

- Usa **HTTPS** sul server (il token viaggia in header/querystring).
- Token lungo, casuale, mai committato: `cowork_domains.json` è in `.gitignore`,
  così come le sottocartelle reali di `connections/`.
- Tieni `cowork_tasks.db` (creato da `tasks.php`) fuori dal web root, o nega
  l'accesso diretto via HTTP a livello server.
- Metti in coda solo prompt di cui ti fidi: vengono eseguiti con i permessi della
  sessione Cowork che li preleva.

## Esempio completo

`examples/editorial-content-automation/` mostra un'automazione reale costruita su
questo motore (backend remoto): bozze di articoli generate da un prompt, cover
create con un generatore d'immagini, post social multi-piattaforma, un "diario di
voce" per mantenere coerenza di tono nel tempo. Utile come riferimento per capire
quanto in là si può spingere questo pattern — non è richiesto per usare il
connettore in modo semplice.

## Autore

Creato da **Dario Santocanale** — [SaintChannel](https://saintchannel.com).
Se lo usi o lo estendi, un link al repo originale è sempre apprezzato.

## Licenza

MIT — vedi `LICENSE`. Puoi usare, copiare, modificare, fondere con altro codice,
pubblicare, distribuire e persino vendere copie del software (anche dentro
prodotti chiusi/commerciali), a due condizioni: mantieni la nota di copyright e
la licenza nei file che ridistribuisci, e non hai alcuna garanzia — il software
è fornito "così com'è". Non è richiesto contribuire indietro le modifiche.

Non sono un legale: questa è una sintesi informativa, non una consulenza legale.
Per un progetto che vuole massimizzare diffusione e riconoscibilità (anche del
tuo nome, che resta nel copyright di ogni copia), MIT è la scelta più adottata
nell'open source. Se in futuro vuoi restringere il riuso commerciale (es.
impedire che qualcuno lo rivenda come servizio concorrente senza contribuire),
le alternative da valutare sono l'AGPLv3 (copyleft forte, ma riduce l'adozione
da parte di aziende) o una licenza source-available come la Business Source
License (protegge di più, ma non è "open source" riconosciuto: niente badge
OSI, minore credibilità nella community open source). Cambiare licenza in
futuro è possibile solo per le versioni successive che pubblichi — non è
retroattivo su copie già distribuite sotto MIT.

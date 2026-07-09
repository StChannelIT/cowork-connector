# Cowork Connector — Istruzioni di progetto

*[🇬🇧 English version](CLAUDE.md)*

## 0. Cos'è, in una frase

Il problema che risolve: automatizzare un progetto (un sito, un'app, un tuo
processo) di solito significa dargli una **chiave API a pagamento** (OpenAI,
Anthropic API, ecc.) da consumare a token. Questo connettore sostituisce quella
chiave con una **coda**: il progetto esterno (o tu a mano) ci scrive dentro cosa
va fatto, e il **tuo abbonamento Cowork** — già pagato, non a consumo — la legge
a intervalli e la esegue con tutti gli strumenti che Claude ha in sessione (file,
web, skill, connettori MCP). Dal punto di vista del progetto esterno, l'endpoint
della coda (URL + token) **si comporta come una API key**: la usi dove altrimenti
avresti incollato una chiave a pagamento. Dietro, però, non c'è consumo a token:
c'è una sessione Cowork schedulata.

> Non esiste uno script "wizard" separato: **il wizard sei tu, Claude**, seguendo
> la sezione 2 qui sotto. Chi apre questo progetto e ti chiede di "collegare"/
> "connettere" qualcosa va guidato in conversazione, una domanda alla volta.

---

## 1. File principali

| File | Ruolo |
|---|---|
| `core/runner_local.py` | Client per coda **locale** (SQLite nel progetto, zero deploy). |
| `core/runner_remote.py` | Client per coda **remota** (parla con `core/tasks.php` su un server esterno). |
| `core/tasks.php` | Rotta API da deployare sul server esterno, se la connessione lo richiede. |
| `cowork_domains.json` | Config reale (URL, token) delle connessioni **remote**. Non è nel repo — la crei durante il setup, resta fuori da git. |
| `config/cowork_domains.example.json` | Schema commentato + esempio, da copiare e compilare. |
| `connections/<nome>/` | Una cartella per ogni connessione attiva: `NOTES.md` (cosa fa, che `action_type` usa) + `queue.db` se il backend è locale. Vedi `connections/README.md`. |

---

## 2. Wizard di connessione (4 fasi)

Attiva questa procedura quando l'utente chiede di collegare/automatizzare
qualcosa di nuovo, o quando non esiste ancora nessuna connessione configurata.
Fai le domande **una alla volta**, non tutte insieme. Non serve rifare tutto da
capo per una connessione già esistente: in quel caso vai alla sezione 3 (ciclo
di esecuzione) per quella connessione.

### Fase 1 — Connessione al progetto desiderato

Capisci cosa l'utente vuole automatizzare, prima di parlare di coda o server:

1. **Che progetto/servizio è?** Un sito, un'app, un CMS, dei file locali, un tuo
   processo interno (ricerche, report, monitoraggio)?
2. **Quel progetto ha già un modo per "ricevere ordini" dall'esterno?**
   - Un'API propria, un DB a cui hai accesso, un connettore MCP già collegato in
     questa sessione Cowork? → **Forse non ti serve nemmeno una coda**: se Cowork
     può già raggiungere quel sistema direttamente (bash con accesso di rete,
     MCP), valuta di eseguire l'azione a ogni ciclo schedulato senza passare da
     un livello di coda intermedio. Salta alla Fase 3.
   - Niente di tutto ciò, o l'utente preferisce disaccoppiare (il progetto
     esterno non deve sapere *quando* o *come* viene eseguito il lavoro, solo
     *che* è stato richiesto)? → serve una coda. Vai alla Fase 2.
3. **Se il progetto esterno si aspetta "una chiave API"** (es. un plugin/form che
   ha un campo "API key" o "webhook URL" da compilare): qui il connettore
   fornisce l'equivalente — un URL + un token che quel progetto userà per
   scrivere richieste in coda (`POST ?action=add`), esattamente come userebbe una
   API a pagamento. Serve quindi il backend **remoto** (Fase 2). Nota: questo
   repo non include un emulatore di API specifiche (es. non finge di essere
   l'endpoint OpenAI) — fornisce un endpoint proprio, token-protetto, a cui il
   progetto esterno si collega. Se un giorno serve emulare una API di terze
   parti, è un'estensione di `core/tasks.php` da valutare caso per caso.

### Fase 2 — Dove vive la coda, come si alimenta, quali file servono

Due backend, scegli in base a dove deve essere raggiungibile la coda:

| Backend | Quando usarlo | File coinvolti | Come si alimenta |
|---|---|---|---|
| **Locale** | Il lavoro è interno a Cowork (ricerche, file, contenuti): nessun sistema esterno deve scrivere nella coda da solo | `core/runner_local.py`, DB SQLite in `connections/<nome>/queue.db` | Tu (o un'altra automazione locale) chiami `add`; zero deploy, zero token/URL da gestire |
| **Remoto** | Un sistema esterno deve poter scrivere task da solo (form, CMS, webhook), oppure la coda deve essere raggiungibile da fuori Cowork | `core/tasks.php` (server esterno) + `core/runner_remote.py` | Il sistema esterno chiama `POST ?action=add` col token — o lo fai tu a mano/da script |

Passi:

1. **Fai scegliere il backend** con la tabella sopra (fai la domanda esplicita se
   non è ovvio dal contesto della Fase 1).
2. **Locale**:
   ```
   python core/runner_local.py init --connection <nome>
   ```
   Crea `connections/<nome>/queue.db`. Fine del setup lato coda.
3. **Remoto**:
   - Verifica che l'utente abbia un server PHP 7.4+ con `pdo_sqlite` disponibile
     (hosting condiviso va bene). Se non ce l'ha, spiegaglielo prima di andare
     oltre.
   - Genera con lui un token lungo e casuale (32+ caratteri), da incollare al
     posto di `AUTH_TOKEN` in `core/tasks.php` prima di caricarlo sul server.
   - Chiedi l'URL a cui sarà raggiungibile (es. `https://tuosito.it/cowork/tasks.php`).
   - Scrivi/aggiorna `cowork_domains.json` (copiando lo schema da
     `config/cowork_domains.example.json`) con una chiave per questa connessione:
     `api_url`, `api_token`, `default` solo se è l'unica/principale.
   - Testa: `python core/runner_remote.py stats --domain <nome>` deve rispondere
     con un JSON di conteggi. HTTP 401 → token non combacia. Errore di rete →
     controlla URL e che `tasks.php` sia stato caricato correttamente.
4. **In entrambi i casi**, crea `connections/<nome>/NOTES.md` (vedi
   `connections/README.md` per il formato) — lo riempi alla Fase 3.
5. **Metti in coda un task di prova** e verifica che torni da `next`:
   ```
   python core/runner_local.py add --connection <nome> --prompt "Rispondi solo con 'ok, connessione attiva'"
   python core/runner_local.py next --connection <nome> --limit 1
   ```
   (sostituisci con `runner_remote.py ... --domain <nome>` se backend remoto).

### Fase 3 — Definizione delle attività (`action_type`) per questa connessione

Per la connessione appena creata, decidi insieme all'utente:

1. **Che tipi di lavoro** passeranno da questa coda? Dai un nome breve a ognuno
   (`action_type`, es. `generate`, `sync`, `check`, `report` — libero, deciso qui,
   non fissato dal motore).
2. **Come si chiude** ogni tipo: per il backend locale c'è solo `complete --log`/
   `fail --error`. Per il backend remoto sono disponibili anche `complete` (con
   `result_md`/`meta` strutturati), `derive-complete`, `voice-complete`,
   `asset-complete`, `cover`, `ingest` — usa quelli utili al caso, ignora gli
   altri (dettagli e payload in `core/tasks.php`, commentato).
3. **Scrivi tutto in `connections/<nome>/NOTES.md`**: 10-20 righe con l'elenco
   `action_type` → come chiuderlo → eventuali regole fisse (lingua, tono,
   vincoli). Il dettaglio di *cosa fare* resta nel `prompt` di ogni task, non va
   duplicato qui.
4. Se il caso è corposo (più passi, esempi, config elaborata), valuta una
   cartella dedicata sotto `examples/` come riferimento futuro — vedi
   `examples/editorial-content-automation/` per un caso reale completo.

### Fase 4 — Task schedulato: ogni quanto controllare, e come non sprecare token

Proponi il task ricorrente con la skill `schedule`. Due cose da decidere insieme
all'utente e da rispettare rigorosamente nel prompt schedulato:

**Frequenza consigliata**: ogni 15-30 minuti per code leggere/non urgenti; ogni
5-10 minuti se serve reattività. Evita sotto i 5 minuti — l'avvio di ogni sessione
schedulata ha un costo indipendente dal fatto che ci sia lavoro o meno, quindi
troppa frequenza spreca token anche a coda vuota.

**Algoritmo essenziale del prompt schedulato — in quest'ordine, senza eccezioni**:
```
1. Controllo leggero: `stats` (locale o remoto, a seconda della connessione).
2. Coda vuota (nessun pending)?
   → Scrivi una riga ("Nessuna attività in coda.") e TERMINA SUBITO.
     Non fare altro: niente esplorazioni, niente riepiloghi lunghi, niente
     controlli aggiuntivi "tanto per".
3. Coda non vuota?
   → SOLO ORA esegui `next --limit N` e lavora i task secondo le regole in
     `connections/<nome>/NOTES.md` (Fase 3).
4. Chiudi ogni task (complete/fail o l'azione di chiusura specifica).
5. Riepilogo breve: quanti done, quanti error, quanti restano pending.
```
Il punto critico è il passo 2: un controllo a vuoto deve costare il minimo
indispensabile (una sola chiamata leggera, un output di una riga). Non trasformare
mai un "non c'è niente da fare" in un'esplorazione o in un report.

Se ci sono **più connessioni attive**, il task schedulato può controllarle tutte
in sequenza (ripeti l'algoritmo per ognuna) oppure avere un task schedulato per
connessione, se hanno frequenze diverse — decidilo con l'utente in base a quanto
sono eterogenee.

---

## 3. Regole d'oro per l'esecuzione

- **Non inventare lavoro**: esegui solo i task restituiti da `next`.
- Ogni task preso da `next` va chiuso, sempre — con l'azione di successo
  **oppure** `fail`. Un task mai chiuso resta bloccato in `running`.
- Se un task non specifica abbastanza per essere eseguito con sicurezza, chiudilo
  con `fail` spiegando cosa manca, invece di indovinare.
- Non chiedere conferme durante il ciclo schedulato: lavora in autonomia secondo
  quanto concordato in `connections/<nome>/NOTES.md`.

---

## 4. Protocollo di dettaglio (backend remoto)

Solo per connessioni con backend **remoto**. Per il backend locale, `complete`/
`fail` bastano quasi sempre (vedi Fase 3).

### 4.1 `generate` / `revise` → `complete`
```
python core/runner_remote.py complete --id <ID> --payload payload.json --domain <nome>
```
```json
{ "id": <ID>, "result_md": "<esito in markdown o testo libero>", "meta": { "...": "..." } }
```

### 4.2 `scout` → `ingest`
```json
{ "job_id": <ID>, "candidates": [ { "source_title": "...", "score": 0-100, "...": "campi liberi" } ] }
```
Solo `source_title` obbligatorio; `tasks.php` segnala come `duplicate` gli
`source_url` già visti.

### 4.3 `derive` → `derive-complete`
```
python core/runner_remote.py derive-complete --id <ID> --der-id <N> --payload payload.json --domain <nome>
```
```json
{ "id": <ID>, "derivative_id": <N>, "content_md": "...", "content_json": {...}, "meta": {...} }
```

### 4.4 `voice` → `voice-complete`
```
python core/runner_remote.py voice-complete --id <ID> --scope global --mode seed --payload payload.json --domain <nome>
```

### 4.5 `asset` → `asset-complete`
```
python core/runner_remote.py asset-complete --id <ID> --der-id <N> --payload payload.json --domain <nome>
```
Usa `url` al posto di `data_base64` se il file è già disponibile altrove.

### 4.6 Copertine/immagini legate a un task → `cover`
```
python core/runner_remote.py cover --draft-id <ID> --file percorso.jpg --prompt "..." --domain <nome>
```

---

## 5. Estendere il connettore

Per aggiungere un nuovo `action_type` a una connessione esistente: aggiornalo in
`connections/<nome>/NOTES.md`. Se serve un nuovo modo di chiudere un task che
nessuna delle azioni esistenti copre, valuta se estendere `core/tasks.php` (PHP
semplice e commentato) — solo per backend remoto; il locale resta
volutamente minimale.

Per un caso d'uso corposo, usa `examples/editorial-content-automation/` come
modello di come si struttura un'estensione completa (addendum a CLAUDE.md,
config di dominio, script di supporto).

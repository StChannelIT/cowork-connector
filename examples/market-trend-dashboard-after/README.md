# Market Trend Dashboard — versione "dopo" (Cowork Connector)

Stessa dashboard della versione ["prima"](../market-trend-dashboard-before/),
ma la richiesta di analisi non chiama più un'API a pagamento: viene messa
nella coda del Cowork Connector (`tasks.php`, una copia di
`core/tasks.php` — l'originale non viene mai toccato) e verrà eseguita da
una sessione Cowork, schedulata o lanciata a mano, secondo le istruzioni in
[`CLAUDE-addendum.md`](CLAUDE-addendum.md).

## Setup

1. Apri `tasks.php` e cambia `AUTH_TOKEN` con un token lungo e casuale
   (32+ caratteri).
2. **Locale**: da questa cartella, `php -S localhost:8000`, poi apri
   `http://localhost:8000/index.html` (richiede PHP con `pdo_sqlite`; se non
   disponibile in locale, salta direttamente al deploy online).
3. **Online**: carica tutti i file di questa cartella (`index.html`,
   `app.js`, `tasks.php`) nella stessa directory su un hosting PHP, poi apri
   `https://tuosito.com/percorso/index.html`.
4. Nella pagina, incolla il token scelto al punto 1 nel campo "Token di
   accesso" e premi "Salva" (resta solo nel `localStorage` del browser).

⚠️ Se il file `cowork_tasks.db` finisce nella web root pubblica, chiunque conosca l'URL può scaricarne l'intera cronologia dei job. Spostalo fuori dalla web root, oppure blocca l'accesso HTTP diretto (es. una regola `.htaccess`/nginx che nega le richieste dirette a `*.db`).

## Uso

Alla prima apertura, o finché non imposti un token, la dashboard mostra
alcuni **job di esempio** (banner "Dati di esempio" ben visibile) così che
stat card, grafico e tabella non siano mai vuoti — utile per uno
screenshot o una demo senza dover far girare nulla. Appena imposti un
token valido e arriva almeno un job reale, i dati di esempio spariscono e
non vengono più mostrati.

Inserisci un ticker o una parola chiave e premi "Analizza": il job entra in
coda con `action_type: market_trend`. Compare nella tabella "Job recenti"
una volta **eseguito** (non è istantaneo: serve una sessione Cowork che lo
prenda in carico — vedi `CLAUDE-addendum.md` per come instradarlo, e la
sezione "Esecuzione task schedulati" nel `CLAUDE.md` principale per come
schedularla).

Ogni analisi resta in coda: la sezione **"Registro per target"** raggruppa
automaticamente lo storico per target (BTC, ETH, una parola chiave...),
mostrando quante volte è stato analizzato, l'ultimo punteggio, il trend
rispetto all'analisi precedente e un grafico dell'andamento — la prova
visibile di cosa il connettore accumula nel tempo, cosa che la versione
"prima" (chiamata sincrona, nessuno storico) non può offrire.

## Diventare una connessione vera

Per usare questa dashboard sul serio (non solo come esempio): segui la
Fase 2/3 del wizard in `CLAUDE.md` (root del progetto) per registrare
`connections/market-trend-dashboard/NOTES.md` con l'`action_type`
`market_trend` descritto qui, e la Fase 4 per lo schedule.

## Confronto

Vedi [`examples/market-trend-dashboard-before/`](../market-trend-dashboard-before/)
per la versione con chiamata diretta a un'API a pagamento.

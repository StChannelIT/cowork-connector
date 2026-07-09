# Market Trend Dashboard — versione "prima"

Esempio illustrativo: una dashboard che lancia un'analisi di trend su un
asset crypto o una parola chiave social **chiamando direttamente un'API AI
a pagamento**, come si farebbe tipicamente senza il Cowork Connector (vedi
`CLAUDE.md` §0 nella root del progetto).

`API_URL`/`API_KEY` in `app.js` sono **segnaposto illustrativi**: senza una
chiave reale, ogni analisi termina nel `catch` e mostra un messaggio che lo
spiega — è il comportamento atteso, non un bug.

## Come provarla

Apri `index.html` in un browser (doppio click, o un server statico
qualsiasi). Inserisci un target e premi "Analizza": vedrai il messaggio
placeholder, a meno di sostituire le credenziali con quelle di un provider
reale.

## Confronto

Vedi [`examples/market-trend-dashboard-after/`](../market-trend-dashboard-after/)
per la stessa dashboard integrata con la coda del Cowork Connector al posto
della chiamata diretta.

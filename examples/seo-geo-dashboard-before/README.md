# SEO/GEO Audit Dashboard — versione "prima"

Esempio illustrativo: una dashboard che lancia un audit SEO + citabilità AI
(GEO) su un dominio **chiamando direttamente un'API AI a pagamento**, come
si farebbe tipicamente senza il Cowork Connector (vedi `CLAUDE.md` §0 nella
root del progetto).

`API_URL`/`API_KEY` in `app.js` sono **segnaposto illustrativi**: senza una
chiave reale, ogni analisi termina nel `catch` e mostra un report di
esempio (chiaramente etichettato come tale) invece di un errore grezzo — è
il comportamento atteso, non un bug.

## Come provarla

Apri `index.html` in un browser (doppio click, o un server statico
qualsiasi). Inserisci un dominio (e opzionalmente una parola chiave) e premi
"Analizza": vedrai il report placeholder, a meno di sostituire le
credenziali con quelle di un provider reale.

## Confronto

Vedi [`examples/seo-geo-dashboard-after/`](../seo-geo-dashboard-after/) per
la stessa dashboard integrata con la coda del Cowork Connector al posto
della chiamata diretta — lì trovi anche un "Registro per sito" con lo
storico degli audit, impossibile da avere qui: una chiamata sincrona non
lascia traccia una volta ricevuta la risposta.

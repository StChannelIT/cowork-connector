# connections/

Ogni **connessione** (= un progetto/servizio esterno o un automatismo interno che
hai collegato al connettore) ha una sua sottocartella qui, creata dal wizard
durante la Fase 2 di `CLAUDE.md`:

```
connections/
  <nome-connessione>/
    NOTES.md      — cosa fa questa connessione, quali action_type usa e come si chiudono
    queue.db      — solo se il backend scelto è "locale" (core/runner_local.py)
```

Se il backend scelto è **remoto** (`core/tasks.php`), non c'è un `queue.db` qui:
la coda vive sul server esterno, e questa cartella contiene solo `NOTES.md` più
l'eventuale riferimento alla chiave usata in `cowork_domains.json` (mai il token
in chiaro — quello resta solo in `cowork_domains.json`, fuori da git).

`NOTES.md` di ogni connessione è pensato per essere breve: 10-20 righe che
rispondono a "cosa fa" e "che action_type ha, e come chiuderli" — il dettaglio
del *come* eseguire il lavoro resta nel `prompt` di ogni task, non va duplicato
qui.

Questa cartella (tranne questo file) è in `.gitignore`: i `queue.db` e i `NOTES.md`
delle tue connessioni reali sono locali, non finiscono nel repo pubblico.

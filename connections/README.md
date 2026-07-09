# connections/

*[🇮🇹 Versione italiana](README.it.md)*

Every **connection** (= an external project/service or an internal
automation you've linked to the connector) has its own subfolder here,
created by the wizard during Phase 2 of `CLAUDE.md`:

```
connections/
  <connection-name>/
    NOTES.md      — what this connection does, which action_types it uses, and how they're closed
    queue.db      — only if the chosen backend is "local" (core/runner_local.py)
```

If the chosen backend is **remote** (`core/tasks.php`), there's no
`queue.db` here: the queue lives on the external server, and this folder
only contains `NOTES.md` plus, at most, a reference to the key used in
`cowork_domains.json` (never the token in plain text — that stays only in
`cowork_domains.json`, outside git).

Each connection's `NOTES.md` is meant to be short: 10-20 lines answering
"what it does" and "which action_types it has, and how to close them" — the
detail of *how* to do the work stays in each task's `prompt`, it shouldn't be
duplicated here.

This folder (except for this file) is in `.gitignore`: the `queue.db` and
`NOTES.md` files of your real connections are local, they don't end up in
the public repo.

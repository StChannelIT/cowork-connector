#!/usr/bin/env python3
"""
runner_local.py — Cowork Connector: coda LOCALE (zero deploy)
================================================================
Backend alternativo a core/tasks.php + core/runner_remote.py, per connessioni
che non hanno bisogno di un server esterno: la coda vive in un file SQLite
dentro il progetto Cowork stesso. Nessun hosting, nessun token, nessuna
richiesta di rete — solo libreria standard Python.

Usalo quando il lavoro è "interno" a Cowork (ricerche web, file, documenti,
skill) e nessun sistema esterno ha bisogno di scrivere task da solo. Se invece
un sito/CMS/altro tool deve poter mettere in coda un task per conto suo, serve
il backend remoto (core/tasks.php) — vedi CLAUDE.md, sezione "Fase 2".

Convenzione consigliata: un database per connessione, in
`connections/<nome-connessione>/queue.db` (usa --connection per puntarci senza
scrivere il percorso a mano). In alternativa --db <percorso> per un file custom.

Comandi:
  init            [--db path | --connection nome]
  add             --prompt "..." [--action-type t] [--folder f] [--params '{...}']
                  [--priority N] [--max-attempts N] [--db path | --connection nome]
  next            [--limit N] [--db path | --connection nome]
  list            [--status s] [--db path | --connection nome]
  stats           [--db path | --connection nome]
  complete        --id N --log "esito" [--db path | --connection nome]
  fail            --id N --error "motivo" [--db path | --connection nome]
  reset           --id N [--db path | --connection nome]

Nota OneDrive/Drive: se la cartella di progetto è sincronizzata (OneDrive,
Google Drive...), il DB usa journal_mode=TRUNCATE invece di WAL — WAL non è
affidabile su filesystem di rete/sincronizzati.
"""

import argparse
import datetime
import json
import pathlib
import sqlite3
import sys

HERE = pathlib.Path(__file__).parent.parent  # radice del progetto (accanto a core/)


def _resolve_db(a):
    if getattr(a, "db", None):
        return pathlib.Path(a.db)
    if getattr(a, "connection", None):
        d = HERE / "connections" / a.connection
        d.mkdir(parents=True, exist_ok=True)
        return d / "queue.db"
    # default: un'unica coda locale generica nella radice del progetto
    return HERE / "cowork_local_queue.db"


def _connect(db_path):
    db_path = pathlib.Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(db_path)
    con.execute("PRAGMA journal_mode=TRUNCATE;")  # affidabile su cartelle sincronizzate
    con.execute("""CREATE TABLE IF NOT EXISTS tasks (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        prompt        TEXT    NOT NULL,
        target_folder TEXT,
        action_type   TEXT    NOT NULL DEFAULT 'mixed',
        params        TEXT    DEFAULT '{}',
        priority      INTEGER NOT NULL DEFAULT 5,
        status        TEXT    NOT NULL DEFAULT 'pending',
        attempts      INTEGER NOT NULL DEFAULT 0,
        max_attempts  INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT    NOT NULL,
        started_at    TEXT,
        finished_at   TEXT,
        result_log    TEXT,
        error         TEXT
    );""")
    con.execute("CREATE INDEX IF NOT EXISTS idx_tasks_status_prio ON tasks(status, priority, id);")
    con.commit()
    return con


def now_iso():
    return datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------------------
# Comandi
# ---------------------------------------------------------------------------

def cmd_init(a):
    db = _resolve_db(a)
    _connect(db)
    print(f"OK: coda inizializzata in {db}")


def cmd_add(a):
    db = _resolve_db(a)
    con = _connect(db)
    params = a.params
    if params:
        params = params.strip()
        if not (params.startswith("{") or params.startswith("[")):
            p = pathlib.Path(params)
            params = p.read_text(encoding="utf-8") if p.exists() else "{}"
    else:
        params = "{}"
    try:
        json.loads(params)
    except json.JSONDecodeError as e:
        print(f"ERRORE: --params non è JSON valido: {e}", file=sys.stderr)
        sys.exit(2)
    cur = con.execute(
        """INSERT INTO tasks (prompt, target_folder, action_type, params, priority, max_attempts, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)""",
        (a.prompt, a.target_folder, a.action_type, params, a.priority, a.max_attempts, now_iso()),
    )
    con.commit()
    print(json.dumps({"ok": True, "id": cur.lastrowid}))


def cmd_next(a):
    db = _resolve_db(a)
    con = _connect(db)
    con.execute("BEGIN IMMEDIATE;")
    rows = con.execute(
        """SELECT * FROM tasks WHERE status='pending' AND attempts < max_attempts
           ORDER BY priority ASC, id ASC LIMIT ?""",
        (a.limit,),
    ).fetchall()
    cols = [d[0] for d in con.execute("SELECT * FROM tasks LIMIT 0").description]
    out = []
    for r in rows:
        row = dict(zip(cols, r))
        con.execute(
            "UPDATE tasks SET status='running', started_at=?, attempts=attempts+1 WHERE id=?",
            (now_iso(), row["id"]),
        )
        out.append({
            "id": row["id"],
            "prompt": row["prompt"],
            "target_folder": row["target_folder"],
            "action_type": row["action_type"],
            "params": json.loads(row["params"] or "{}"),
            "priority": row["priority"],
            "attempt": row["attempts"] + 1,
            "max_attempts": row["max_attempts"],
        })
    con.commit()
    print(json.dumps(out, ensure_ascii=False))


def cmd_list(a):
    db = _resolve_db(a)
    con = _connect(db)
    q = "SELECT id, status, priority, action_type, target_folder, substr(prompt,1,80) FROM tasks"
    params = ()
    if a.status:
        q += " WHERE status=?"
        params = (a.status,)
    q += " ORDER BY status, priority, id"
    for row in con.execute(q, params):
        print(row)


def cmd_stats(a):
    db = _resolve_db(a)
    con = _connect(db)
    rows = dict(con.execute("SELECT status, COUNT(*) FROM tasks GROUP BY status").fetchall())
    print(json.dumps(rows))


def cmd_complete(a):
    db = _resolve_db(a)
    con = _connect(db)
    con.execute(
        "UPDATE tasks SET status='done', finished_at=?, result_log=? WHERE id=?",
        (now_iso(), a.log, a.id),
    )
    con.commit()
    print(json.dumps({"ok": True, "id": a.id, "status": "done"}))


def cmd_fail(a):
    db = _resolve_db(a)
    con = _connect(db)
    row = con.execute("SELECT attempts, max_attempts FROM tasks WHERE id=?", (a.id,)).fetchone()
    if not row:
        print(json.dumps({"ok": False, "error": "not_found"}))
        sys.exit(1)
    new_status = "pending" if row[0] < row[1] else "error"
    con.execute(
        "UPDATE tasks SET status=?, finished_at=?, error=? WHERE id=?",
        (new_status, now_iso(), a.error, a.id),
    )
    con.commit()
    print(json.dumps({"ok": True, "id": a.id, "status": new_status}))


def cmd_reset(a):
    db = _resolve_db(a)
    con = _connect(db)
    con.execute(
        "UPDATE tasks SET status='pending', started_at=NULL, finished_at=NULL, error=NULL WHERE id=?",
        (a.id,),
    )
    con.commit()
    print(json.dumps({"ok": True, "id": a.id, "status": "pending"}))


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def _add_db_args(p):
    p.add_argument("--db", default=None, help="Percorso file .db custom")
    p.add_argument("--connection", default=None, help="Nome connessione: usa connections/<nome>/queue.db")


def build_parser():
    p = argparse.ArgumentParser(description="Cowork Connector — coda locale (zero deploy).")
    sub = p.add_subparsers(dest="cmd", required=True)

    i = sub.add_parser("init", help="Crea/inizializza il DB della coda")
    _add_db_args(i); i.set_defaults(func=cmd_init)

    ad = sub.add_parser("add", help="Aggiunge un task alla coda")
    ad.add_argument("--prompt", required=True)
    ad.add_argument("--action-type", dest="action_type", default="mixed")
    ad.add_argument("--folder", dest="target_folder", default=None)
    ad.add_argument("--params", default=None, help="JSON inline o percorso file")
    ad.add_argument("--priority", type=int, default=5)
    ad.add_argument("--max-attempts", type=int, default=1, dest="max_attempts")
    _add_db_args(ad); ad.set_defaults(func=cmd_add)

    n = sub.add_parser("next", help="Preleva i task pending (claim atomico)")
    n.add_argument("--limit", type=int, default=5)
    _add_db_args(n); n.set_defaults(func=cmd_next)

    l = sub.add_parser("list", help="Elenco task")
    l.add_argument("--status", default=None)
    _add_db_args(l); l.set_defaults(func=cmd_list)

    st = sub.add_parser("stats", help="Conteggio per stato")
    _add_db_args(st); st.set_defaults(func=cmd_stats)

    c = sub.add_parser("complete", help="Chiude un task con esito positivo")
    c.add_argument("--id", type=int, required=True)
    c.add_argument("--log", default="")
    _add_db_args(c); c.set_defaults(func=cmd_complete)

    f = sub.add_parser("fail", help="Segna un task come fallito (retry se restano tentativi)")
    f.add_argument("--id", type=int, required=True)
    f.add_argument("--error", default="errore non specificato")
    _add_db_args(f); f.set_defaults(func=cmd_fail)

    r = sub.add_parser("reset", help="Rimette un task in pending")
    r.add_argument("--id", type=int, required=True)
    _add_db_args(r); r.set_defaults(func=cmd_reset)

    return p


if __name__ == "__main__":
    args = build_parser().parse_args()
    args.func(args)

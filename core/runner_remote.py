#!/usr/bin/env python3
"""
runner_remote.py — Cowork Connector: client CLI per la coda remota
====================================================================
Parla con la rotta PHP del server (core/tasks.php). Nessun file locale
obbligatorio: il server è l'unica fonte di verità. Backup automatico (JSON
grezzo da `next`) in backups/.

Config — priorità:
  1. Variabili d'ambiente: COWORK_API_URL, COWORK_API_TOKEN, COWORK_DOMAIN
  2. cowork_domains.json nella cartella di progetto (usa il dominio con
     "default": true, oppure --domain <nome>)

Comandi:
  next            [--limit N] [--domain d]
  add             --prompt "..." [--action-type t] [--folder f] [--params '{...}']
                  [--priority N] [--max-attempts N] [--domain d]
  complete        --id N [--log "testo"] [--payload '{...}'] [--domain d]
  derive-complete --id N --der-id N --payload '{...}' [--domain d]
  voice-complete  --id N --scope global --mode seed --payload '{...}' [--domain d]
  asset-complete  --id N --der-id N --payload '{...}' [--domain d]
  cover           --draft-id N (--url URL | --file path) [--prompt "..."] [--domain d]
  fail            --id N --error "motivo" [--domain d]
  stats           [--domain d]
  status          --draft-id N [--domain d]
  recent          [--limit N] [--domain d]
  domain-config   [--domain d]

Nota: --payload/--params accettano JSON inline oppure il percorso di un file .json.

NOTA ESECUZIONE: se il ciclo schedulato gira in un ambiente con rete ristretta
(es. un sandbox con allowlist), esegui questo script tramite uno strumento con
accesso rete completo disponibile in quell'ambiente (es. desktop remoto, VM,
runner esterno) invece che nel sandbox stesso.
"""

import argparse
import base64
import datetime
import io
import json
import os
import pathlib
import sys
import urllib.parse
import urllib.request
import urllib.error

# Forza stdout UTF-8 su Windows (evita crash cp1252)
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ---------------------------------------------------------------------------
# Config da cowork_domains.json
# ---------------------------------------------------------------------------
_DOMAINS_FILE = pathlib.Path(__file__).parent.parent / "cowork_domains.json"
_BACKUP_DIR   = pathlib.Path(__file__).parent.parent / "backups"


def load_domains():
    if _DOMAINS_FILE.exists():
        try:
            with open(_DOMAINS_FILE, encoding="utf-8") as f:
                data = json.load(f)
            return {k: v for k, v in data.items() if not k.startswith("_")}
        except Exception as e:
            print(f"AVVISO: impossibile leggere {_DOMAINS_FILE}: {e}", file=sys.stderr)
    return {}


def get_domain_config(domain=None):
    domains = load_domains()
    if not domains:
        return {}
    domain = domain or os.environ.get("COWORK_DOMAIN")
    if domain and domain in domains:
        return domains[domain]
    for cfg in domains.values():
        if cfg.get("default"):
            return cfg
    return next(iter(domains.values()))


def resolve_url_token(domain=None):
    cfg   = get_domain_config(domain)
    url   = os.environ.get("COWORK_API_URL")   or cfg.get("api_url")   or ""
    token = os.environ.get("COWORK_API_TOKEN") or cfg.get("api_token") or ""
    return url, token


# Valori globali (sovrascritti da --domain a runtime)
BASE_URL, TOKEN = resolve_url_token()

# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------

def call(action, method="GET", query=None, payload=None):
    """Esegui una richiesta all'endpoint tasks.php del dominio attivo."""
    if not BASE_URL:
        print(
            "ERRORE: nessun server configurato. Copia config/cowork_domains.example.json "
            "in cowork_domains.json e compila api_url/api_token (o imposta le variabili "
            "d'ambiente COWORK_API_URL / COWORK_API_TOKEN).",
            file=sys.stderr,
        )
        sys.exit(2)
    qs = {"action": action}
    if query:
        qs.update(query)
    url = BASE_URL + "?" + urllib.parse.urlencode(qs)
    headers = {"X-Auth-Token": TOKEN}
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read().decode("utf-8-sig")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        print(f"ERRORE HTTP {e.code}: {body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"ERRORE rete: {e.reason}", file=sys.stderr)
        sys.exit(1)


# ---------------------------------------------------------------------------
# Backup automatico (solo dati ricevuti dal server, nessuno stato proprio)
# ---------------------------------------------------------------------------

def _backup(data, label="next"):
    """Salva una copia JSON timestampata di `data` in backups/."""
    try:
        _BACKUP_DIR.mkdir(exist_ok=True)
        ts   = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        path = _BACKUP_DIR / f"{label}_{ts}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"AVVISO backup: {e}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Payload helper: JSON inline o file
# ---------------------------------------------------------------------------

def _load_payload(raw):
    """Interpreta --payload/--params: stringa JSON inline oppure percorso file .json."""
    if raw is None:
        return None
    raw = raw.strip()
    if raw.startswith("{") or raw.startswith("["):
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            print(f"ERRORE: JSON non valido: {e}", file=sys.stderr)
            sys.exit(2)
    p = pathlib.Path(raw)
    if not p.exists():
        print(f"ERRORE: file non trovato: {p}", file=sys.stderr)
        sys.exit(2)
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"ERRORE lettura file: {e}", file=sys.stderr)
        sys.exit(2)


# ---------------------------------------------------------------------------
# Comandi
# ---------------------------------------------------------------------------

def _apply_domain(a):
    global BASE_URL, TOKEN
    domain = getattr(a, "domain", None)
    if domain:
        BASE_URL, TOKEN = resolve_url_token(domain)


def cmd_next(a):
    _apply_domain(a)
    raw = call("next", query={"limit": a.limit})
    try:
        tasks = json.loads(raw)
        if isinstance(tasks, list) and tasks:
            _backup(tasks, label="next")
        print(json.dumps(tasks, ensure_ascii=False))
    except Exception:
        print(raw)


def cmd_add(a):
    """Inserisce un nuovo task in coda."""
    _apply_domain(a)
    params = _load_payload(a.params) or {}
    body = {
        "prompt": a.prompt,
        "action_type": a.action_type,
        "target_folder": a.target_folder,
        "domain": a.domain_tag,
        "params": params,
        "priority": a.priority,
        "max_attempts": a.max_attempts,
    }
    print(call("add", method="POST", payload=body))


def cmd_stats(a):
    _apply_domain(a)
    print(call("stats"))


def cmd_status(a):
    _apply_domain(a)
    print(call("status", query={"draft_id": a.draft_id}))


def cmd_recent(a):
    _apply_domain(a)
    print(call("recent", query={"limit": a.limit}))


def cmd_complete(a):
    """
    Chiude un job generate/revise.
    --log     : esito breve (per job semplici)
    --payload : JSON completo con result_md, meta, ecc. Sovrascrive --log se fornito.
    """
    _apply_domain(a)
    extra = _load_payload(getattr(a, "payload", None))
    if extra:
        body = extra
        body.setdefault("id", a.id)
    else:
        body = {"id": a.id, "result_md": a.log}
    print(call("complete", method="POST", payload=body))


def cmd_derive_complete(a):
    _apply_domain(a)
    extra = _load_payload(a.payload) or {}
    extra["id"]            = a.id
    extra["derivative_id"] = extra.get("derivative_id") or a.der_id
    print(call("derive_complete", method="POST", payload=extra))


def cmd_voice_complete(a):
    _apply_domain(a)
    extra = _load_payload(a.payload) or {}
    extra["id"] = a.id
    extra.setdefault("scope", a.scope)
    extra.setdefault("mode",  a.mode)
    print(call("voice_complete", method="POST", payload=extra))


def cmd_asset_complete(a):
    _apply_domain(a)
    extra = _load_payload(a.payload) or {}
    extra["id"]            = a.id
    extra["derivative_id"] = extra.get("derivative_id") or a.der_id
    print(call("asset_complete", method="POST", payload=extra))


def cmd_cover(a):
    """Consegna la cover al server: file locale (--file) oppure URL (--url)."""
    _apply_domain(a)
    body = {"draft_id": a.draft_id}
    if a.prompt:
        body["cover_prompt"] = a.prompt

    if a.file:
        p = pathlib.Path(a.file)
        if not p.exists():
            print(f"ERRORE: file non trovato: {p}", file=sys.stderr)
            sys.exit(2)
        raw_bytes = p.read_bytes()
        if len(raw_bytes) > 9_500_000:
            print(f"AVVISO: file {len(raw_bytes)//1024} KB — vicino al limite server, considera ricompressione.", file=sys.stderr)
        body["data_base64"] = base64.b64encode(raw_bytes).decode("ascii")
    elif a.url:
        body["cover_url"] = a.url
    else:
        print("ERRORE: specifica --file oppure --url", file=sys.stderr)
        sys.exit(2)

    print(call("cover", method="POST", payload=body))


def cmd_fail(a):
    _apply_domain(a)
    print(call("fail", method="POST", payload={"id": a.id, "error": a.error}))


def cmd_domain_config(a):
    domain = getattr(a, "domain", None)
    cfg = get_domain_config(domain)
    print(json.dumps(cfg, ensure_ascii=False, indent=2))


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def _add_domain_arg(parser):
    parser.add_argument("--domain", default=None,
                        help="Dominio da usare (chiave in cowork_domains.json). Default: dominio con default=true.")


def build_parser():
    p = argparse.ArgumentParser(description="Cowork Connector — client CLI per la coda remota.")
    sub = p.add_subparsers(dest="cmd", required=True)

    n = sub.add_parser("next", help="Preleva job pending")
    n.add_argument("--limit", type=int, default=5)
    _add_domain_arg(n); n.set_defaults(func=cmd_next)

    ad = sub.add_parser("add", help="Aggiunge un nuovo task alla coda")
    ad.add_argument("--prompt", required=True)
    ad.add_argument("--action-type", dest="action_type", default="generate")
    ad.add_argument("--folder", dest="target_folder", default=None)
    ad.add_argument("--domain-tag", dest="domain_tag", default=None,
                     help="Valore informativo del campo 'domain' salvato sul task (diverso da --domain, che sceglie il server)")
    ad.add_argument("--params", default=None, help="JSON inline o percorso file")
    ad.add_argument("--priority", type=int, default=5)
    ad.add_argument("--max-attempts", type=int, default=1, dest="max_attempts")
    _add_domain_arg(ad); ad.set_defaults(func=cmd_add)

    st = sub.add_parser("stats", help="Conteggi coda")
    _add_domain_arg(st); st.set_defaults(func=cmd_stats)

    ss = sub.add_parser("status", help="Stato di un task specifico")
    ss.add_argument("--draft-id", type=int, required=True, dest="draft_id")
    _add_domain_arg(ss); ss.set_defaults(func=cmd_status)

    rc = sub.add_parser("recent", help="Ultimi job completati")
    rc.add_argument("--limit", type=int, default=10)
    _add_domain_arg(rc); rc.set_defaults(func=cmd_recent)

    c = sub.add_parser("complete", help="Chiude un job generate/revise")
    c.add_argument("--id",      type=int, required=True)
    c.add_argument("--log",     default="", help="Esito breve (usato se --payload non è fornito)")
    c.add_argument("--payload", default=None, help="JSON completo (inline o percorso file)")
    _add_domain_arg(c); c.set_defaults(func=cmd_complete)

    dc = sub.add_parser("derive-complete", help="Chiude un job derive/der_revise")
    dc.add_argument("--id",      type=int, required=True)
    dc.add_argument("--der-id",  type=int, default=0, dest="der_id")
    dc.add_argument("--payload", required=True, help="JSON con content_md, content_json, meta")
    _add_domain_arg(dc); dc.set_defaults(func=cmd_derive_complete)

    vc = sub.add_parser("voice-complete", help="Chiude un job voice")
    vc.add_argument("--id",      type=int, required=True)
    vc.add_argument("--scope",   default="global")
    vc.add_argument("--mode",    default="seed")
    vc.add_argument("--payload", required=True, help="JSON con profile_md (e scope/mode opzionali)")
    _add_domain_arg(vc); vc.set_defaults(func=cmd_voice_complete)

    ac = sub.add_parser("asset-complete", help="Chiude un job asset")
    ac.add_argument("--id",      type=int, required=True)
    ac.add_argument("--der-id",  type=int, default=0, dest="der_id")
    ac.add_argument("--payload", required=True, help="JSON con provider, assets:[...]")
    _add_domain_arg(ac); ac.set_defaults(func=cmd_asset_complete)

    cv = sub.add_parser("cover", help="Consegna cover (file locale o URL)")
    cv.add_argument("--draft-id", type=int, required=True, dest="draft_id")
    cv.add_argument("--file",   default=None, help="Percorso file immagine locale (jpg/png/webp)")
    cv.add_argument("--url",    default=None, help="URL dell'immagine")
    cv.add_argument("--prompt", default=None, help="Prompt usato per generare la cover")
    _add_domain_arg(cv); cv.set_defaults(func=cmd_cover)

    f = sub.add_parser("fail", help="Segna un job come fallito")
    f.add_argument("--id",    type=int, required=True)
    f.add_argument("--error", default="errore non specificato")
    _add_domain_arg(f); f.set_defaults(func=cmd_fail)

    dconf = sub.add_parser("domain-config", help="Mostra la config del dominio attivo")
    _add_domain_arg(dconf); dconf.set_defaults(func=cmd_domain_config)

    return p


if __name__ == "__main__":
    args = build_parser().parse_args()
    args.func(args)

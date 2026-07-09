#!/usr/bin/env python3
"""
runner_remote.py — Cowork Connector: CLI client for the remote queue
====================================================================
Talks to the server's PHP route (core/tasks.php). No local file is
required: the server is the single source of truth. Automatic backup (raw
JSON from `next`) in backups/.

Config — priority order:
  1. Environment variables: COWORK_API_URL, COWORK_API_TOKEN, COWORK_DOMAIN
  2. cowork_domains.json in the project folder (uses the domain with
     "default": true, or --domain <name>)

Commands:
  next            [--limit N] [--domain d]
  add             --prompt "..." [--action-type t] [--folder f] [--params '{...}']
                  [--priority N] [--max-attempts N] [--domain d]
  complete        --id N [--log "text"] [--payload '{...}'] [--domain d]
  derive-complete --id N --der-id N --payload '{...}' [--domain d]
  voice-complete  --id N --scope global --mode seed --payload '{...}' [--domain d]
  asset-complete  --id N --der-id N --payload '{...}' [--domain d]
  cover           --draft-id N (--url URL | --file path) [--prompt "..."] [--domain d]
  fail            --id N --error "reason" [--domain d]
  stats           [--domain d]
  status          --draft-id N [--domain d]
  recent          [--limit N] [--domain d]
  domain-config   [--domain d]

Note: --payload/--params accept inline JSON or the path to a .json file.

EXECUTION NOTE: if the scheduled cycle runs in an environment with
restricted network access (e.g. a sandbox with an allowlist), run this
script through a tool with full network access available in that
environment (e.g. a remote desktop, a VM, an external runner) instead of in
the sandbox itself.
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

# Force UTF-8 stdout on Windows (avoids cp1252 crashes)
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ---------------------------------------------------------------------------
# Config from cowork_domains.json
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
            print(f"WARNING: couldn't read {_DOMAINS_FILE}: {e}", file=sys.stderr)
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


# Global values (overridden by --domain at runtime)
BASE_URL, TOKEN = resolve_url_token()

# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------

def call(action, method="GET", query=None, payload=None):
    """Make a request to the tasks.php endpoint of the active domain."""
    if not BASE_URL:
        print(
            "ERROR: no server configured. Copy config/cowork_domains.example.json "
            "to cowork_domains.json and fill in api_url/api_token (or set the "
            "COWORK_API_URL / COWORK_API_TOKEN environment variables).",
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
        print(f"HTTP ERROR {e.code}: {body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"NETWORK ERROR: {e.reason}", file=sys.stderr)
        sys.exit(1)


# ---------------------------------------------------------------------------
# Automatic backup (only data received from the server, no state of its own)
# ---------------------------------------------------------------------------

def _backup(data, label="next"):
    """Save a timestamped JSON copy of `data` in backups/."""
    try:
        _BACKUP_DIR.mkdir(exist_ok=True)
        ts   = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        path = _BACKUP_DIR / f"{label}_{ts}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"BACKUP WARNING: {e}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Payload helper: inline JSON or file
# ---------------------------------------------------------------------------

def _load_payload(raw):
    """Interpret --payload/--params: inline JSON string or a .json file path."""
    if raw is None:
        return None
    raw = raw.strip()
    if raw.startswith("{") or raw.startswith("["):
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            print(f"ERROR: invalid JSON: {e}", file=sys.stderr)
            sys.exit(2)
    p = pathlib.Path(raw)
    if not p.exists():
        print(f"ERROR: file not found: {p}", file=sys.stderr)
        sys.exit(2)
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"ERROR reading file: {e}", file=sys.stderr)
        sys.exit(2)


# ---------------------------------------------------------------------------
# Commands
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
    """Insert a new task into the queue."""
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
    Closes a generate/revise job.
    --log     : short outcome (for simple jobs)
    --payload : full JSON with result_md, meta, etc. Overrides --log if provided.
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
    """Deliver the cover to the server: local file (--file) or URL (--url)."""
    _apply_domain(a)
    body = {"draft_id": a.draft_id}
    if a.prompt:
        body["cover_prompt"] = a.prompt

    if a.file:
        p = pathlib.Path(a.file)
        if not p.exists():
            print(f"ERROR: file not found: {p}", file=sys.stderr)
            sys.exit(2)
        raw_bytes = p.read_bytes()
        if len(raw_bytes) > 9_500_000:
            print(f"WARNING: file is {len(raw_bytes)//1024} KB — close to the server limit, consider recompressing.", file=sys.stderr)
        body["data_base64"] = base64.b64encode(raw_bytes).decode("ascii")
    elif a.url:
        body["cover_url"] = a.url
    else:
        print("ERROR: specify --file or --url", file=sys.stderr)
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
                        help="Domain to use (key in cowork_domains.json). Default: the domain with default=true.")


def build_parser():
    p = argparse.ArgumentParser(description="Cowork Connector — CLI client for the remote queue.")
    sub = p.add_subparsers(dest="cmd", required=True)

    n = sub.add_parser("next", help="Claim pending jobs")
    n.add_argument("--limit", type=int, default=5)
    _add_domain_arg(n); n.set_defaults(func=cmd_next)

    ad = sub.add_parser("add", help="Add a new task to the queue")
    ad.add_argument("--prompt", required=True)
    ad.add_argument("--action-type", dest="action_type", default="generate")
    ad.add_argument("--folder", dest="target_folder", default=None)
    ad.add_argument("--domain-tag", dest="domain_tag", default=None,
                     help="Informational value of the 'domain' field saved on the task (different from --domain, which selects the server)")
    ad.add_argument("--params", default=None, help="Inline JSON or file path")
    ad.add_argument("--priority", type=int, default=5)
    ad.add_argument("--max-attempts", type=int, default=1, dest="max_attempts")
    _add_domain_arg(ad); ad.set_defaults(func=cmd_add)

    st = sub.add_parser("stats", help="Queue counts")
    _add_domain_arg(st); st.set_defaults(func=cmd_stats)

    ss = sub.add_parser("status", help="Status of a specific task")
    ss.add_argument("--draft-id", type=int, required=True, dest="draft_id")
    _add_domain_arg(ss); ss.set_defaults(func=cmd_status)

    rc = sub.add_parser("recent", help="Most recently completed jobs")
    rc.add_argument("--limit", type=int, default=10)
    _add_domain_arg(rc); rc.set_defaults(func=cmd_recent)

    c = sub.add_parser("complete", help="Close a generate/revise job")
    c.add_argument("--id",      type=int, required=True)
    c.add_argument("--log",     default="", help="Short outcome (used if --payload isn't provided)")
    c.add_argument("--payload", default=None, help="Full JSON (inline or file path)")
    _add_domain_arg(c); c.set_defaults(func=cmd_complete)

    dc = sub.add_parser("derive-complete", help="Close a derive/der_revise job")
    dc.add_argument("--id",      type=int, required=True)
    dc.add_argument("--der-id",  type=int, default=0, dest="der_id")
    dc.add_argument("--payload", required=True, help="JSON with content_md, content_json, meta")
    _add_domain_arg(dc); dc.set_defaults(func=cmd_derive_complete)

    vc = sub.add_parser("voice-complete", help="Close a voice job")
    vc.add_argument("--id",      type=int, required=True)
    vc.add_argument("--scope",   default="global")
    vc.add_argument("--mode",    default="seed")
    vc.add_argument("--payload", required=True, help="JSON with profile_md (and optional scope/mode)")
    _add_domain_arg(vc); vc.set_defaults(func=cmd_voice_complete)

    ac = sub.add_parser("asset-complete", help="Close an asset job")
    ac.add_argument("--id",      type=int, required=True)
    ac.add_argument("--der-id",  type=int, default=0, dest="der_id")
    ac.add_argument("--payload", required=True, help="JSON with provider, assets:[...]")
    _add_domain_arg(ac); ac.set_defaults(func=cmd_asset_complete)

    cv = sub.add_parser("cover", help="Deliver a cover (local file or URL)")
    cv.add_argument("--draft-id", type=int, required=True, dest="draft_id")
    cv.add_argument("--file",   default=None, help="Path to a local image file (jpg/png/webp)")
    cv.add_argument("--url",    default=None, help="Image URL")
    cv.add_argument("--prompt", default=None, help="Prompt used to generate the cover")
    _add_domain_arg(cv); cv.set_defaults(func=cmd_cover)

    f = sub.add_parser("fail", help="Mark a job as failed")
    f.add_argument("--id",    type=int, required=True)
    f.add_argument("--error", default="unspecified error")
    _add_domain_arg(f); f.set_defaults(func=cmd_fail)

    dconf = sub.add_parser("domain-config", help="Show the active domain's config")
    _add_domain_arg(dconf); dconf.set_defaults(func=cmd_domain_config)

    return p


if __name__ == "__main__":
    args = build_parser().parse_args()
    args.func(args)

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Client for a registry of sources to monitor (blogs, creators, channels) —
editorial domain example. Talks to `sources.php` (same token pattern as
core/tasks.php).

Usage:
  python radar_sources.py list                  # GET sources (all)
  python radar_sources.py list --active         # only active ones
  python radar_sources.py list --tag ai-video   # filter by tag
  python radar_sources.py ingest sources_payload.json   # POST upsert

Token:
  - by default uses sources.token from the domain (in cowork_domains.json);
  - override with the SOURCES_TOKEN environment variable or --token.
"""
import sys, os, json, argparse, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
DOMAINS = os.path.join(HERE, "..", "..", "cowork_domains.json")


def load_domain(domain=None):
    cfg = json.load(open(DOMAINS, encoding="utf-8-sig"))
    cfg = {k: v for k, v in cfg.items() if not k.startswith("_")}
    if domain is None:
        domain = next((k for k, v in cfg.items() if v.get("default")), None) or next(iter(cfg))
    return cfg[domain]


def resolve(domain=None, token_override=None):
    d = load_domain(domain)
    r = d["sources"]
    base = r["base_url"].rstrip("/")
    token = token_override or os.environ.get("SOURCES_TOKEN")
    if not token:
        token = d["api_token"] if r.get("token") == "api_token" else r.get("token")
    return base, r, token


def http(method, url, token, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"X-Auth-Token": token, "User-Agent": "cowork-connector"}
    if data:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=40)
        raw = resp.read().decode("utf-8-sig", "replace")
        return resp.getcode(), (json.loads(raw) if raw.strip() else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8-sig", "replace")
        return e.code, raw


def cmd_list(args):
    base, r, token = resolve(args.domain, args.token)
    url = base + r["sources_get"] + "&token=" + token
    if args.active:
        url += "&active=1"
    if args.tag:
        url += "&tag=" + args.tag
    code, js = http("GET", url, token)
    print("HTTP", code)
    if code != 200 or not isinstance(js, dict):
        print(js)
        return
    print("ok=%s  count=%s" % (js.get("ok"), js.get("count")))
    for s in js.get("sources", []):
        refs = ", ".join((rf.get("ref_type", "") + ":" + (rf.get("url") or rf.get("handle") or "")) for rf in s.get("refs", []))
        print(u"- %-22s [%s/%s] tags=%s | %s | refs: %s" % (
            s.get("name"), s.get("kind"), s.get("lang"), s.get("tags"), s.get("topics"), refs))


def cmd_ingest(args):
    base, r, token = resolve(args.domain, args.token)
    payload = json.load(open(args.payload, encoding="utf-8-sig"))
    payload.setdefault("source", r.get("ingest_source", "cowork"))
    url = base + r["sources_ingest"] + "&token=" + token
    code, js = http("POST", url, token, payload)
    print("HTTP", code)
    print(json.dumps(js, ensure_ascii=False, indent=2) if isinstance(js, dict) else js)
    if isinstance(js, dict):
        print("created=%s  updated=%s" % (js.get("created"), js.get("updated")))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--domain")
    ap.add_argument("--token")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("list"); p.add_argument("--active", action="store_true"); p.add_argument("--tag")
    p.set_defaults(func=cmd_list)
    p = sub.add_parser("ingest"); p.add_argument("payload")
    p.set_defaults(func=cmd_ingest)
    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

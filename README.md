# Cowork Connector

*[🇮🇹 Versione italiana](README.it.md)*

`v0.1.0` — see `CHANGELOG.md` for the version history.

Automating an external project usually means handing it a **paid API key**
(OpenAI, Anthropic API, etc.) to consume by the token. Cowork Connector
replaces that key: you give the external project an endpoint (or a local
file) to write "what needs to be done" to, and reading/executing it is your
**Cowork subscription** — already paid for, not metered per use. A
**scheduled** Cowork session picks up queued tasks and runs them with every
tool Claude already has available — files, web, skills, MCP connectors —
then reports back the outcome.

It's not an MCP connector: it's simpler. A queue (local, or on your own
server) plus a scheduled task that reads it. Zero custom integrations with
paid external APIs, zero keys to manage on the Cowork side beyond a token you
generate yourself.

```
LOCAL backend (zero deploy)                   REMOTE backend (external server)
──────────────────────────────                ────────────────────────────────
You (local script) ──add──► queue.db          External system ──POST add──► tasks.php ──► SQLite
                               │                (e.g. a website, a form, a CMS)      │
   Cowork (scheduled) ────────►│  claims             Cowork (scheduled) ──GET next──►│  claims
   and executes with its                             and executes with its
   tools ──complete/fail─────►│                      tools ──complete/fail─────────►│
```

## Why this pattern

- **Your Cowork subscription instead of API keys**: the queue's endpoint (URL +
  token) or local file acts as a "credential" wherever an external system
  would expect an API key — but the execution happens in your Cowork session,
  not on metered API tokens.
- **No custom integration**: queue up any request in natural language, Claude
  executes it with the tools it already has in session.
- **Decoupled**: define a task whenever you want (by hand, from a script, from
  your own CMS/form); it runs on the next scheduled cycle.
- **Traceable**: every task has status, log, timestamps, attempts.
- **Robust**: atomic claim (no double execution), configurable retries.
- **Generic**: a task's `action_type` is a free-form label defined per
  connection — you decide what "generate", "scout", "sync-inventory", or
  anything else you need, actually means.

## Two backends, pick based on your case

| | Local backend | Remote backend |
|---|---|---|
| When | The work is internal to Cowork (research, files, content) | An external system needs to write tasks on its own (form, CMS, webhook) |
| Where the queue lives | SQLite inside the project (`connections/<name>/queue.db`) | PHP + SQLite on your own external server |
| Requirements | None beyond Python 3 (stdlib) | Server with PHP 7.4+ and `pdo_sqlite` |
| Files | `core/runner_local.py` | `core/tasks.php` + `core/runner_remote.py` |

You can have several connections active at once, each with the backend that
fits best — see `connections/`.

## Requirements

- **Claude Cowork**, with access to this project and to the `schedule` skill
  for the recurring task.
- Python 3, standard library only (no packages to install).
- Only if you use the remote backend for at least one connection: a server
  with PHP 7.4+ and `pdo_sqlite` (shared hosting works fine).

## Repo structure

| Path | Role |
|---|---|
| `CLAUDE.md` | Project instructions: protocol + **4-phase connection wizard** (guides Claude to connect a new project through conversation — not a separate script). |
| `core/runner_local.py` | Client for the **local** queue (SQLite in the project, zero deploy). |
| `core/tasks.php` | API route for the **remote** queue, to upload to your server. Creates its own SQLite database next to itself. |
| `core/runner_remote.py` | CLI client that talks to `tasks.php`. |
| `config/cowork_domains.example.json` | Schema + example configuration for remote connections. Copy it to `cowork_domains.json` (outside git, holds the tokens). |
| `connections/` | One folder per active connection (config/notes/local queue). See `connections/README.md`. |
| `examples/editorial-content-automation/` | A real, complete use case — editorial automation (article draft + generated cover + social posts) — as a reference for building your own. |

## Quick start

1. **Clone/download this repo** into your Cowork project folder.
2. **Open a Cowork session in this project and say what you want to
   automate** (e.g. "I want to connect my blog to generate drafts
   automatically", or "I want it to search for news on X every morning").
   There's no separate wizard script: `CLAUDE.md` instructs Claude to act as
   your wizard in 4 phases — connecting to the desired project,
   choosing/creating the queue (local or remote), defining the tasks, and the
   scheduled task.
3. If the connection requires the **remote** backend, Claude will guide you
   through uploading `core/tasks.php` to your server with a token generated
   on the spot, and testing it:
   ```
   curl -H "X-Auth-Token: YOUR_TOKEN" "https://yoursite.com/cowork/tasks.php?action=stats"
   ```
   → it must respond with a JSON of counts (even if all zero).
4. **Claude schedules the cycle** using the `schedule` skill — how often to
   check the queue is decided together (15-30 min is a good default), and the
   scheduled prompt always follows the same essential algorithm: light
   check → queue empty? stop immediately, without wasting tokens → queue not
   empty? execute according to the process agreed for that connection.
5. **Queue the first task**, for example (local backend):
   ```
   python core/runner_local.py add --connection <name> \
     --prompt "Search for the 3 most relevant news items on X and write a summary in report/news.md" \
     --action-type generate --priority 3
   ```
   On the next cycle, Cowork picks it up and executes it.

## Protocol (remote backend)

`core/tasks.php` exposes the following, all protected by the token
(`X-Auth-Token` or `?token=`):

| Action | Method | What it's for |
|---|---|---|
| `next` | GET | Claims `pending` tasks (atomic claim → `running`) |
| `add` | POST | Inserts a new task into the queue |
| `complete` | POST | Closes a task with a positive outcome (free-form `result_md`, `meta`) |
| `derive_complete` | POST | Closes a task that produces a "derivative" (e.g. a social post from already-ready content) |
| `voice_complete` | POST | Closes a task that updates a persistent profile/guideline |
| `asset_complete` | POST | Closes a task that produces real assets (images/videos), as files or URLs |
| `cover` | POST | Delivers a cover image linked to a task (base64 or URL) |
| `ingest` | POST | Closes a "candidate research" task with a list of results |
| `fail` | POST | Marks a task as failed (automatic retry if attempts remain) |
| `stats` / `status` / `recent` / `list` | GET | Queue diagnostics and inspection |

The **local** backend (`core/runner_local.py`) exposes the same concept in a
minimal form: `init`, `add`, `next`, `list`, `stats`, `complete`, `fail`,
`reset`.

Payload details for each action are in `CLAUDE.md` and in the commented code
of `core/tasks.php`. `action_type` is **free-form**: you define it per
connection in `connections/<name>/NOTES.md` during the wizard.

## Security

- Use **HTTPS** on the server (the token travels in a header/querystring).
- Long, random token, never committed: `cowork_domains.json` is in
  `.gitignore`, as are the real subfolders of `connections/`.
- Keep `cowork_tasks.db` (created by `tasks.php`) outside the web root, or
  deny direct HTTP access to it at the server level.
- Only queue prompts you trust: they run with the permissions of the Cowork
  session that picks them up.

## Full example

`examples/editorial-content-automation/` shows a real automation built on
this engine (remote backend): article drafts generated from a prompt, covers
created with an image generator, multi-platform social posts, and a "voice
profile" that keeps tone consistent over time. Useful as a reference for how
far this pattern can be pushed — it isn't required to use the connector in a
simple way.

## Author

Created by **Dario Santocanale** — [SaintChannel](https://saintchannel.com).
If you use or extend it, a link back to the original repo is always
appreciated.

## License

MIT — see `LICENSE`. You can use, copy, modify, merge with other code,
publish, distribute, and even sell copies of the software (even inside
closed/commercial products), under two conditions: keep the copyright notice
and license in the files you redistribute, and there's no warranty — the
software is provided "as is". You are not required to contribute changes
back.

I'm not a lawyer: this is an informational summary, not legal advice. For a
project that wants to maximize adoption and recognition (including of your
name, which stays in the copyright of every copy), MIT is the most widely
adopted choice in open source. If in the future you want to restrict
commercial reuse (e.g. prevent someone from reselling it as a competing
service without contributing back), the alternatives worth evaluating are
AGPLv3 (strong copyleft, but reduces adoption by companies) or a
source-available license like the Business Source License (protects more,
but isn't recognized "open source": no OSI badge, less credibility in the
open-source community). Changing the license in the future is only possible
for the later versions you publish — it isn't retroactive on copies already
distributed under MIT.

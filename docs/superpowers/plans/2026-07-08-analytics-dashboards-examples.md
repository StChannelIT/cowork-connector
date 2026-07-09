# Analytics Dashboards (Before/After) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four new, fully standalone example folders under `examples/` — a "before" and an "after" version each for a Market/Crypto Trend dashboard and a SEO/GEO Audit dashboard — showing how a real web dashboard changes when the Cowork Connector's remote queue is wired in.

**Architecture:** Each folder is a self-contained static HTML/CSS/JS page. "Before" folders call a placeholder paid AI API directly and render the response synchronously. "After" folders POST to a bundled copy of `core/tasks.php` (`?action=add`), then poll `?action=recent`/`?action=status` to show job status and results — the actual analysis is executed later by a Cowork session per `CLAUDE-addendum.md`, not by any code in this plan.

**Tech Stack:** Vanilla HTML/CSS/JS (no build step, no external dependencies), PHP 7.4+ (verbatim copy of `core/tasks.php`), Node/PHP CLI only for local verification.

## Global Constraints

- Do not modify any existing file in the repository (`core/tasks.php`, `core/runner_remote.py`, `CLAUDE.md`, `README.md`, `.gitignore`, etc.) — every deliverable is a new file under `examples/`.
- No build tools, bundlers, or external CDN scripts/styles — plain HTML/CSS/JS only.
- No new server-side actions — both `-after` examples close their jobs with the existing `complete` action.
- All user-facing report copy (labels, `result_md` prompts, README narrative) is in Italian, matching the rest of this repo's examples.
- `-after/tasks.php` must be a byte-identical copy of `core/tasks.php` (via `cp`, never retyped) so it stays in sync with the real server route.
- Runtime artifacts created while testing (`*.db`, `*.db-wal`, `*.db-shm`) must be deleted before each commit — `*.db`/`*.db-journal` are already gitignored repo-wide, but `-wal`/`-shm` are not, so clean them up manually rather than editing `.gitignore`.

---

### Task 1: Market Trend Dashboard — "before" (direct paid-API call)

**Files:**
- Create: `examples/market-trend-dashboard-before/index.html`
- Create: `examples/market-trend-dashboard-before/app.js`
- Create: `examples/market-trend-dashboard-before/README.md`

**Interfaces:**
- Produces: a standalone static page with no dependency on any other task. Nothing later consumes code from this task — `market-trend-dashboard-after` shares the same narrative but is written independently in Task 3.

- [ ] **Step 1: Create `examples/market-trend-dashboard-before/index.html`**

```html
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>Market Trend Dashboard — prima (API diretta)</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px; color: #1a1a1a; }
  h1 { font-size: 1.4rem; }
  form { display: flex; gap: 8px; margin: 20px 0; }
  input { flex: 1; padding: 8px; font-size: 1rem; }
  button { padding: 8px 16px; font-size: 1rem; cursor: pointer; }
  #status { font-style: italic; color: #555; margin-bottom: 8px; }
  #result { white-space: pre-wrap; background: #f5f5f5; padding: 12px; border-radius: 6px; min-height: 60px; }
  .note { font-size: 0.85rem; color: #777; margin-top: 24px; }
</style>
</head>
<body>
  <h1>Market Trend Dashboard — versione "prima"</h1>
  <p>Analizza il trend di un asset crypto o di una parola chiave social. Questa versione chiama direttamente un'API AI a pagamento (segnaposto, vedi <code>app.js</code>).</p>
  <form id="analyze-form">
    <input id="target" type="text" placeholder="Es. BTC, oppure 'agentic AI'" required>
    <button type="submit">Analizza</button>
  </form>
  <div id="status"></div>
  <div id="result"></div>
  <p class="note">Esempio illustrativo del Cowork Connector — vedi <code>examples/market-trend-dashboard-after/</code> per la versione integrata con la coda.</p>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `examples/market-trend-dashboard-before/app.js`**

```js
// Placeholder configuration for a typical "give the dashboard a paid API key" setup.
// Replace these with your real provider's endpoint and key to make this version work for real.
const API_URL = 'https://api.example.com/v1/chat/completions';
const API_KEY = 'YOUR_API_KEY_HERE';

const form = document.getElementById('analyze-form');
const targetInput = document.getElementById('target');
const resultEl = document.getElementById('result');
const statusEl = document.getElementById('status');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const target = targetInput.value.trim();
  if (!target) return;

  statusEl.textContent = 'Analisi in corso...';
  resultEl.textContent = '';

  const prompt = `Analizza il trend di mercato/social per: ${target}. Fornisci una sintesi, il sentiment e le metriche chiave.`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? '(risposta vuota)';
    statusEl.textContent = 'Completato.';
    resultEl.textContent = text;
  } catch (err) {
    statusEl.textContent = 'Nessuna chiamata reale eseguita.';
    resultEl.textContent =
      'Questo è un esempio "prima": API_URL e API_KEY in app.js sono segnaposto. ' +
      'Sostituiscili con le credenziali reali di un provider AI a pagamento per far ' +
      'funzionare questa versione, oppure guarda la versione "-after" di questo esempio ' +
      'per il flusso basato sulla coda del Cowork Connector.\n\n' +
      `Errore tecnico: ${err.message}`;
  }
});
```

- [ ] **Step 3: Create `examples/market-trend-dashboard-before/README.md`**

```markdown
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
```

- [ ] **Step 4: Verify JS syntax**

Run: `node --check "examples/market-trend-dashboard-before/app.js"`
Expected: no output, exit code 0.

- [ ] **Step 5: Verify HTML references the right script and form ids**

Run: `grep -c 'id="target"' "examples/market-trend-dashboard-before/index.html" && grep -c 'app.js' "examples/market-trend-dashboard-before/index.html"`
Expected: both greps print `1`.

- [ ] **Step 6: Commit**

```bash
git add examples/market-trend-dashboard-before/index.html examples/market-trend-dashboard-before/app.js examples/market-trend-dashboard-before/README.md
git commit -m "Add market-trend-dashboard-before example (direct paid-API call)"
```

---

### Task 2: SEO/GEO Audit Dashboard — "before" (direct paid-API call)

**Files:**
- Create: `examples/seo-geo-dashboard-before/index.html`
- Create: `examples/seo-geo-dashboard-before/app.js`
- Create: `examples/seo-geo-dashboard-before/README.md`

**Interfaces:**
- Produces: a standalone static page, independent of Task 1's files (same narrative pattern, different copy/fields — deliberately not shared/deduplicated so each example folder stays self-contained and independently deployable).

- [ ] **Step 1: Create `examples/seo-geo-dashboard-before/index.html`**

```html
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>SEO/GEO Audit Dashboard — prima (API diretta)</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px; color: #1a1a1a; }
  h1 { font-size: 1.4rem; }
  form { display: flex; gap: 8px; margin: 20px 0; flex-wrap: wrap; }
  input { flex: 1; min-width: 160px; padding: 8px; font-size: 1rem; }
  button { padding: 8px 16px; font-size: 1rem; cursor: pointer; }
  #status { font-style: italic; color: #555; margin-bottom: 8px; }
  #result { white-space: pre-wrap; background: #f5f5f5; padding: 12px; border-radius: 6px; min-height: 60px; }
  .note { font-size: 0.85rem; color: #777; margin-top: 24px; }
</style>
</head>
<body>
  <h1>SEO/GEO Audit Dashboard — versione "prima"</h1>
  <p>Esegue un audit SEO e di citabilità AI su un dominio. Questa versione chiama direttamente un'API AI a pagamento (segnaposto, vedi <code>app.js</code>).</p>
  <form id="analyze-form">
    <input id="domain" type="text" placeholder="Es. esempio.com" required>
    <input id="keyword" type="text" placeholder="Parola chiave (opzionale)">
    <button type="submit">Analizza</button>
  </form>
  <div id="status"></div>
  <div id="result"></div>
  <p class="note">Esempio illustrativo del Cowork Connector — vedi <code>examples/seo-geo-dashboard-after/</code> per la versione integrata con la coda.</p>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `examples/seo-geo-dashboard-before/app.js`**

```js
// Placeholder configuration for a typical "give the dashboard a paid API key" setup.
// Replace these with your real provider's endpoint and key to make this version work for real.
const API_URL = 'https://api.example.com/v1/chat/completions';
const API_KEY = 'YOUR_API_KEY_HERE';

const form = document.getElementById('analyze-form');
const domainInput = document.getElementById('domain');
const keywordInput = document.getElementById('keyword');
const resultEl = document.getElementById('result');
const statusEl = document.getElementById('status');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const domain = domainInput.value.trim();
  const keyword = keywordInput.value.trim();
  if (!domain) return;

  statusEl.textContent = 'Analisi in corso...';
  resultEl.textContent = '';

  const focus = keyword ? ` focalizzato sulla parola chiave "${keyword}"` : '';
  const prompt = `Esegui un audit SEO e di citabilità AI (GEO) per il dominio ${domain}${focus}. Fornisci un punteggio complessivo e i principali problemi da correggere.`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? '(risposta vuota)';
    statusEl.textContent = 'Completato.';
    resultEl.textContent = text;
  } catch (err) {
    statusEl.textContent = 'Nessuna chiamata reale eseguita.';
    resultEl.textContent =
      'Questo è un esempio "prima": API_URL e API_KEY in app.js sono segnaposto. ' +
      'Sostituiscili con le credenziali reali di un provider AI a pagamento per far ' +
      'funzionare questa versione, oppure guarda la versione "-after" di questo esempio ' +
      'per il flusso basato sulla coda del Cowork Connector.\n\n' +
      `Errore tecnico: ${err.message}`;
  }
});
```

- [ ] **Step 3: Create `examples/seo-geo-dashboard-before/README.md`**

```markdown
# SEO/GEO Audit Dashboard — versione "prima"

Esempio illustrativo: una dashboard che lancia un audit SEO + citabilità AI
(GEO) su un dominio **chiamando direttamente un'API AI a pagamento**, come
si farebbe tipicamente senza il Cowork Connector (vedi `CLAUDE.md` §0 nella
root del progetto).

`API_URL`/`API_KEY` in `app.js` sono **segnaposto illustrativi**: senza una
chiave reale, ogni analisi termina nel `catch` e mostra un messaggio che lo
spiega — è il comportamento atteso, non un bug.

## Come provarla

Apri `index.html` in un browser (doppio click, o un server statico
qualsiasi). Inserisci un dominio (e opzionalmente una parola chiave) e premi
"Analizza": vedrai il messaggio placeholder, a meno di sostituire le
credenziali con quelle di un provider reale.

## Confronto

Vedi [`examples/seo-geo-dashboard-after/`](../seo-geo-dashboard-after/) per
la stessa dashboard integrata con la coda del Cowork Connector al posto
della chiamata diretta.
```

- [ ] **Step 4: Verify JS syntax**

Run: `node --check "examples/seo-geo-dashboard-before/app.js"`
Expected: no output, exit code 0.

- [ ] **Step 5: Verify HTML references the right script and form ids**

Run: `grep -c 'id="domain"' "examples/seo-geo-dashboard-before/index.html" && grep -c 'app.js' "examples/seo-geo-dashboard-before/index.html"`
Expected: both greps print `1`.

- [ ] **Step 6: Commit**

```bash
git add examples/seo-geo-dashboard-before/index.html examples/seo-geo-dashboard-before/app.js examples/seo-geo-dashboard-before/README.md
git commit -m "Add seo-geo-dashboard-before example (direct paid-API call)"
```

---

### Task 3: Market Trend Dashboard — "after" (Cowork Connector queue)

**Files:**
- Create: `examples/market-trend-dashboard-after/tasks.php` (verbatim copy of `core/tasks.php`)
- Create: `examples/market-trend-dashboard-after/index.html`
- Create: `examples/market-trend-dashboard-after/app.js`
- Create: `examples/market-trend-dashboard-after/CLAUDE-addendum.md`
- Create: `examples/market-trend-dashboard-after/domain-config-snippet.json`
- Create: `examples/market-trend-dashboard-after/README.md`

**Interfaces:**
- Consumes: `core/tasks.php`'s existing HTTP contract, unchanged — `?action=add` (body: `{action_type, prompt, params}` → `{ok, id}`), `?action=recent&limit=N` (→ array of `{id, domain, action_type, status, priority, finished_at, excerpt}`), `?action=status&id=N` (→ `{ok, task: {..., result_md, meta}, derivatives, assets}`), auth via `X-Auth-Token` header. These are read directly from `core/tasks.php:177-466` — not redefined here.
- Produces: standalone example, independent of Task 4.

- [ ] **Step 1: Copy `core/tasks.php` verbatim**

```bash
cp "core/tasks.php" "examples/market-trend-dashboard-after/tasks.php"
```

- [ ] **Step 2: Verify the copy is byte-identical to the original**

Run: `diff "core/tasks.php" "examples/market-trend-dashboard-after/tasks.php"`
Expected: no output (files identical).

- [ ] **Step 3: Create `examples/market-trend-dashboard-after/index.html`**

```html
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>Market Trend Dashboard — dopo (Cowork Connector)</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: system-ui, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 16px; color: #1a1a1a; }
  h1 { font-size: 1.4rem; }
  h3 { font-size: 1.05rem; }
  section { margin: 24px 0; }
  form { display: flex; gap: 8px; }
  input { flex: 1; padding: 8px; font-size: 1rem; }
  button { padding: 8px 16px; font-size: 1rem; cursor: pointer; }
  #status { font-style: italic; color: #555; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 0.9rem; }
  .job-row { cursor: pointer; }
  .job-row:hover { background: #f5f5f5; }
  #detail pre { white-space: pre-wrap; background: #f5f5f5; padding: 12px; border-radius: 6px; }
  .note { font-size: 0.85rem; color: #777; }
</style>
</head>
<body>
  <h1>Market Trend Dashboard — versione "dopo"</h1>
  <p>Stessa analisi della versione "prima", ma la richiesta va nella coda del Cowork Connector invece che a un'API a pagamento diretta.</p>

  <section>
    <h3>Token di accesso</h3>
    <form onsubmit="return false">
      <input id="token" type="password" placeholder="Token (vedi tasks.php)">
      <button id="save-token" type="button">Salva</button>
    </form>
  </section>

  <section>
    <h3>Nuova analisi</h3>
    <form id="analyze-form">
      <input id="target" type="text" placeholder="Es. BTC, oppure 'agentic AI'" required>
      <button type="submit">Analizza</button>
    </form>
    <div id="status"></div>
  </section>

  <section>
    <h3>Job recenti</h3>
    <div id="jobs"></div>
  </section>

  <section>
    <h3>Dettaglio</h3>
    <div id="detail"></div>
  </section>

  <p class="note">Esempio illustrativo del Cowork Connector — vedi <code>examples/market-trend-dashboard-before/</code> per la versione con chiamata diretta a un'API a pagamento.</p>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create `examples/market-trend-dashboard-after/app.js`**

```js
const TOKEN_KEY = 'cowork_dashboard_token_market_trend';

const tokenInput = document.getElementById('token');
const saveTokenBtn = document.getElementById('save-token');
const form = document.getElementById('analyze-form');
const targetInput = document.getElementById('target');
const statusEl = document.getElementById('status');
const jobsEl = document.getElementById('jobs');
const detailEl = document.getElementById('detail');

tokenInput.value = localStorage.getItem(TOKEN_KEY) || '';

saveTokenBtn.addEventListener('click', () => {
  localStorage.setItem(TOKEN_KEY, tokenInput.value.trim());
  statusEl.textContent = 'Token salvato.';
  loadJobs();
});

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function api(query, options = {}) {
  const response = await fetch(`tasks.php?${query}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': getToken(),
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const target = targetInput.value.trim();
  if (!target) return;
  if (!getToken()) {
    statusEl.textContent = 'Imposta prima il token (vedi sopra).';
    return;
  }

  const prompt = `Analizza il trend di mercato/social per: ${target}. Fornisci una sintesi, il sentiment e le metriche chiave.`;

  try {
    statusEl.textContent = 'Invio alla coda...';
    await api('action=add', {
      method: 'POST',
      body: JSON.stringify({
        action_type: 'market_trend',
        prompt,
        params: { target },
      }),
    });
    statusEl.textContent = 'Job in coda. Verrà eseguito al prossimo ciclo schedulato.';
    targetInput.value = '';
    loadJobs();
  } catch (err) {
    statusEl.textContent = `Errore: ${err.message}`;
  }
});

async function loadJobs() {
  try {
    const jobs = await api('action=recent&limit=20', { method: 'GET' });
    renderJobs(jobs);
  } catch (err) {
    jobsEl.textContent = `Errore nel caricare i job: ${err.message}`;
  }
}

function renderJobs(jobs) {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    jobsEl.innerHTML = '<p>Nessun job ancora completato o in errore.</p>';
    return;
  }
  const rows = jobs.map((job) => `
    <tr data-id="${job.id}" class="job-row">
      <td>${job.id}</td>
      <td>${escapeHtml(job.action_type)}</td>
      <td>${escapeHtml(job.status)}</td>
      <td>${escapeHtml(job.finished_at || '')}</td>
      <td>${escapeHtml(job.excerpt || '')}</td>
    </tr>
  `).join('');
  jobsEl.innerHTML = `
    <table>
      <thead><tr><th>ID</th><th>Tipo</th><th>Stato</th><th>Completato</th><th>Estratto</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  jobsEl.querySelectorAll('.job-row').forEach((row) => {
    row.addEventListener('click', () => loadDetail(row.dataset.id));
  });
}

async function loadDetail(id) {
  try {
    const data = await api(`action=status&id=${id}`, { method: 'GET' });
    const t = data.task;
    const metaHtml = t.meta && typeof t.meta === 'object'
      ? `<ul>${Object.entries(t.meta).map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(typeof v === 'object' ? JSON.stringify(v) : v)}</li>`).join('')}</ul>`
      : '';
    detailEl.innerHTML = `
      <h3>Job #${t.id} — ${escapeHtml(t.status)}</h3>
      ${metaHtml}
      <pre>${escapeHtml(t.result_md || '(nessun risultato)')}</pre>
    `;
  } catch (err) {
    detailEl.textContent = `Errore nel caricare il dettaglio: ${err.message}`;
  }
}

loadJobs();
setInterval(loadJobs, 5000);
```

- [ ] **Step 5: Create `examples/market-trend-dashboard-after/CLAUDE-addendum.md`**

```markdown
# CLAUDE.md addendum — market trend dashboard (example)

Paste/summarize into your project's `CLAUDE.md` if you deploy this
dashboard for real. Assumes the generic protocol in this repo's `CLAUDE.md`
(remote backend, section 4) and the domain config in
`domain-config-snippet.json`.

---

## `market_trend` flow → crypto/social trend analysis

The task's `params` holds `{ "target": "<ticker or keyword>" }` (also
repeated in the `prompt`, so both are usable).

1. **Gather data**: if `target` looks like a crypto ticker, use the
   LunarCrush MCP tools for cryptocurrencies (price, social volume,
   sentiment, Galaxy Score); if it's a generic keyword/topic, use the
   LunarCrush topic/creator tools instead (interactions, sentiment, top
   posts).
2. **Write `result_md`**: a short report in Italian — synthesis, sentiment,
   3-5 key metrics, 2-3 highlighted posts/creators if relevant.
3. **Write `meta`**: flat numeric fields the dashboard renders as a
   detail list, e.g.:
   ```json
   { "score": 72, "sentiment": "positivo", "social_volume": 18400, "price_change_24h": 3.2 }
   ```
   Only include the fields that make sense for the target (crypto tickers
   get `price_change_24h`, generic keywords may not).
4. **Close**:
   ```
   python core/runner_remote.py complete --id <ID> --payload payload.json --domain <this-domain>
   ```
   ```json
   { "id": <ID>, "result_md": "<report>", "meta": { "...": "..." } }
   ```

No new server action: this closes with the same `complete` action used for
`generate`/`revise` tasks (see main `CLAUDE.md` §4.1).
```

- [ ] **Step 6: Create `examples/market-trend-dashboard-after/domain-config-snippet.json`**

```json
{
  "_comment": "Example block to paste into your cowork_domains.json, under your own domain key. Replace api_url/api_token with your real values.",

  "market-trend-dashboard": {
    "api_url":   "https://yoursite.com/path/to/market-trend-dashboard-after/tasks.php",
    "api_token": "PASTE_YOUR_TOKEN_HERE",
    "default":   false,

    "content": {
      "language": "it",
      "notes": "Dashboard di trend crypto/social. Un solo action_type: market_trend, vedi CLAUDE-addendum.md per come eseguirlo e chiuderlo."
    }
  }
}
```

- [ ] **Step 7: Create `examples/market-trend-dashboard-after/README.md`**

```markdown
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

## Uso

Inserisci un ticker o una parola chiave e premi "Analizza": il job entra in
coda con `action_type: market_trend`. Compare nella tabella "Job recenti"
una volta **eseguito** (non è istantaneo: serve una sessione Cowork che lo
prenda in carico — vedi `CLAUDE-addendum.md` per come instradarlo, e la
sezione "Esecuzione task schedulati" nel `CLAUDE.md` principale per come
schedularla).

## Diventare una connessione vera

Per usare questa dashboard sul serio (non solo come esempio): segui la
Fase 2/3 del wizard in `CLAUDE.md` (root del progetto) per registrare
`connections/market-trend-dashboard/NOTES.md` con l'`action_type`
`market_trend` descritto qui, e la Fase 4 per lo schedule.

## Confronto

Vedi [`examples/market-trend-dashboard-before/`](../market-trend-dashboard-before/)
per la versione con chiamata diretta a un'API a pagamento.
```

- [ ] **Step 8: Verify PHP lint**

Run: `php -l "examples/market-trend-dashboard-after/tasks.php"`
Expected: `No syntax errors detected in examples/market-trend-dashboard-after/tasks.php`

- [ ] **Step 9: Verify JS syntax**

Run: `node --check "examples/market-trend-dashboard-after/app.js"`
Expected: no output, exit code 0.

- [ ] **Step 10: End-to-end smoke test against a local PHP server**

Run, from the repo root:
```bash
cd "examples/market-trend-dashboard-after"
php -S localhost:8091 -t . > /dev/null 2>&1 &
PHP_PID=$!
sleep 1

# 1. No token -> 401
curl -s -o /dev/null -w "unauthorized_status=%{http_code}\n" "http://localhost:8091/tasks.php?action=list"

# 2. Add a job
ADD_RESPONSE=$(curl -s -X POST "http://localhost:8091/tasks.php?action=add" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: CHANGE_THIS_LONG_RANDOM_TOKEN" \
  -d '{"action_type":"market_trend","prompt":"Analizza il trend di mercato/social per: BTC.","params":{"target":"BTC"}}')
echo "add_response=$ADD_RESPONSE"
JOB_ID=$(echo "$ADD_RESPONSE" | grep -o '"id":[0-9]*' | grep -o '[0-9]*')

# 3. Simulate a Cowork session closing the job
curl -s -X POST "http://localhost:8091/tasks.php?action=complete" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: CHANGE_THIS_LONG_RANDOM_TOKEN" \
  -d "{\"id\":$JOB_ID,\"result_md\":\"BTC in trend rialzista.\",\"meta\":{\"score\":72,\"sentiment\":\"positivo\"}}"
echo ""

# 4. Recent should show it as done
curl -s "http://localhost:8091/tasks.php?action=recent&limit=20" -H "X-Auth-Token: CHANGE_THIS_LONG_RANDOM_TOKEN"
echo ""

# 5. Status should return the full result_md and meta
curl -s "http://localhost:8091/tasks.php?action=status&id=$JOB_ID" -H "X-Auth-Token: CHANGE_THIS_LONG_RANDOM_TOKEN"
echo ""

kill $PHP_PID
```

Expected:
- `unauthorized_status=401`
- `add_response` contains `"ok":true` and an `"id"` field
- `recent` output is a JSON array containing one object with `"status": "done"`, `"action_type": "market_trend"`, and an `"excerpt"` starting with `"BTC in trend rialzista."`
- `status` output contains `"result_md": "BTC in trend rialzista."` and `"meta": {"score": 72, "sentiment": "positivo"}` under `task`

- [ ] **Step 11: Clean up runtime artifacts created by the smoke test**

Run:
```bash
cd "examples/market-trend-dashboard-after"
rm -f cowork_tasks.db cowork_tasks.db-wal cowork_tasks.db-shm
git status --short .
```
Expected: only the 6 files created in Steps 1, 3-7 show as untracked (`??`) — no `.db`/`.db-wal`/`.db-shm` left over.

- [ ] **Step 12: Commit**

```bash
git add examples/market-trend-dashboard-after/tasks.php examples/market-trend-dashboard-after/index.html examples/market-trend-dashboard-after/app.js examples/market-trend-dashboard-after/CLAUDE-addendum.md examples/market-trend-dashboard-after/domain-config-snippet.json examples/market-trend-dashboard-after/README.md
git commit -m "Add market-trend-dashboard-after example (Cowork Connector queue)"
```

---

### Task 4: SEO/GEO Audit Dashboard — "after" (Cowork Connector queue)

**Files:**
- Create: `examples/seo-geo-dashboard-after/tasks.php` (verbatim copy of `core/tasks.php`)
- Create: `examples/seo-geo-dashboard-after/index.html`
- Create: `examples/seo-geo-dashboard-after/app.js`
- Create: `examples/seo-geo-dashboard-after/CLAUDE-addendum.md`
- Create: `examples/seo-geo-dashboard-after/domain-config-snippet.json`
- Create: `examples/seo-geo-dashboard-after/README.md`

**Interfaces:**
- Consumes: same `core/tasks.php` HTTP contract as Task 3 (independent copy, own DB file since `DB_FILE = __DIR__ . '/cowork_tasks.db'` is folder-relative).
- Produces: standalone example, independent of Task 3.

- [ ] **Step 1: Copy `core/tasks.php` verbatim**

```bash
cp "core/tasks.php" "examples/seo-geo-dashboard-after/tasks.php"
```

- [ ] **Step 2: Verify the copy is byte-identical to the original**

Run: `diff "core/tasks.php" "examples/seo-geo-dashboard-after/tasks.php"`
Expected: no output (files identical).

- [ ] **Step 3: Create `examples/seo-geo-dashboard-after/index.html`**

```html
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>SEO/GEO Audit Dashboard — dopo (Cowork Connector)</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: system-ui, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 16px; color: #1a1a1a; }
  h1 { font-size: 1.4rem; }
  h3 { font-size: 1.05rem; }
  section { margin: 24px 0; }
  form { display: flex; gap: 8px; flex-wrap: wrap; }
  input { flex: 1; min-width: 160px; padding: 8px; font-size: 1rem; }
  button { padding: 8px 16px; font-size: 1rem; cursor: pointer; }
  #status { font-style: italic; color: #555; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 0.9rem; }
  .job-row { cursor: pointer; }
  .job-row:hover { background: #f5f5f5; }
  #detail pre { white-space: pre-wrap; background: #f5f5f5; padding: 12px; border-radius: 6px; }
  .note { font-size: 0.85rem; color: #777; }
</style>
</head>
<body>
  <h1>SEO/GEO Audit Dashboard — versione "dopo"</h1>
  <p>Stesso audit della versione "prima", ma la richiesta va nella coda del Cowork Connector invece che a un'API a pagamento diretta.</p>

  <section>
    <h3>Token di accesso</h3>
    <form onsubmit="return false">
      <input id="token" type="password" placeholder="Token (vedi tasks.php)">
      <button id="save-token" type="button">Salva</button>
    </form>
  </section>

  <section>
    <h3>Nuova analisi</h3>
    <form id="analyze-form">
      <input id="domain" type="text" placeholder="Es. esempio.com" required>
      <input id="keyword" type="text" placeholder="Parola chiave (opzionale)">
      <button type="submit">Analizza</button>
    </form>
    <div id="status"></div>
  </section>

  <section>
    <h3>Job recenti</h3>
    <div id="jobs"></div>
  </section>

  <section>
    <h3>Dettaglio</h3>
    <div id="detail"></div>
  </section>

  <p class="note">Esempio illustrativo del Cowork Connector — vedi <code>examples/seo-geo-dashboard-before/</code> per la versione con chiamata diretta a un'API a pagamento.</p>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create `examples/seo-geo-dashboard-after/app.js`**

```js
const TOKEN_KEY = 'cowork_dashboard_token_seo_geo';

const tokenInput = document.getElementById('token');
const saveTokenBtn = document.getElementById('save-token');
const form = document.getElementById('analyze-form');
const domainInput = document.getElementById('domain');
const keywordInput = document.getElementById('keyword');
const statusEl = document.getElementById('status');
const jobsEl = document.getElementById('jobs');
const detailEl = document.getElementById('detail');

tokenInput.value = localStorage.getItem(TOKEN_KEY) || '';

saveTokenBtn.addEventListener('click', () => {
  localStorage.setItem(TOKEN_KEY, tokenInput.value.trim());
  statusEl.textContent = 'Token salvato.';
  loadJobs();
});

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function api(query, options = {}) {
  const response = await fetch(`tasks.php?${query}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': getToken(),
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const domain = domainInput.value.trim();
  const keyword = keywordInput.value.trim();
  if (!domain) return;
  if (!getToken()) {
    statusEl.textContent = 'Imposta prima il token (vedi sopra).';
    return;
  }

  const focus = keyword ? ` focalizzato sulla parola chiave "${keyword}"` : '';
  const prompt = `Esegui un audit SEO e di citabilità AI (GEO) per il dominio ${domain}${focus}. Fornisci un punteggio complessivo e i principali problemi da correggere.`;

  try {
    statusEl.textContent = 'Invio alla coda...';
    await api('action=add', {
      method: 'POST',
      body: JSON.stringify({
        action_type: 'seo_geo_audit',
        prompt,
        params: { domain, keyword },
      }),
    });
    statusEl.textContent = 'Job in coda. Verrà eseguito al prossimo ciclo schedulato.';
    domainInput.value = '';
    keywordInput.value = '';
    loadJobs();
  } catch (err) {
    statusEl.textContent = `Errore: ${err.message}`;
  }
});

async function loadJobs() {
  try {
    const jobs = await api('action=recent&limit=20', { method: 'GET' });
    renderJobs(jobs);
  } catch (err) {
    jobsEl.textContent = `Errore nel caricare i job: ${err.message}`;
  }
}

function renderJobs(jobs) {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    jobsEl.innerHTML = '<p>Nessun job ancora completato o in errore.</p>';
    return;
  }
  const rows = jobs.map((job) => `
    <tr data-id="${job.id}" class="job-row">
      <td>${job.id}</td>
      <td>${escapeHtml(job.action_type)}</td>
      <td>${escapeHtml(job.status)}</td>
      <td>${escapeHtml(job.finished_at || '')}</td>
      <td>${escapeHtml(job.excerpt || '')}</td>
    </tr>
  `).join('');
  jobsEl.innerHTML = `
    <table>
      <thead><tr><th>ID</th><th>Tipo</th><th>Stato</th><th>Completato</th><th>Estratto</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  jobsEl.querySelectorAll('.job-row').forEach((row) => {
    row.addEventListener('click', () => loadDetail(row.dataset.id));
  });
}

async function loadDetail(id) {
  try {
    const data = await api(`action=status&id=${id}`, { method: 'GET' });
    const t = data.task;
    const metaHtml = t.meta && typeof t.meta === 'object'
      ? `<ul>${Object.entries(t.meta).map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(typeof v === 'object' ? JSON.stringify(v) : v)}</li>`).join('')}</ul>`
      : '';
    detailEl.innerHTML = `
      <h3>Job #${t.id} — ${escapeHtml(t.status)}</h3>
      ${metaHtml}
      <pre>${escapeHtml(t.result_md || '(nessun risultato)')}</pre>
    `;
  } catch (err) {
    detailEl.textContent = `Errore nel caricare il dettaglio: ${err.message}`;
  }
}

loadJobs();
setInterval(loadJobs, 5000);
```

- [ ] **Step 5: Create `examples/seo-geo-dashboard-after/CLAUDE-addendum.md`**

```markdown
# CLAUDE.md addendum — SEO/GEO audit dashboard (example)

Paste/summarize into your project's `CLAUDE.md` if you deploy this
dashboard for real. Assumes the generic protocol in this repo's `CLAUDE.md`
(remote backend, section 4) and the domain config in
`domain-config-snippet.json`.

---

## `seo_geo_audit` flow → lightweight SEO + AI-citability audit

The task's `params` holds `{ "domain": "<domain>", "keyword": "<optional>" }`
(also repeated in the `prompt`).

1. **Run the audit**: use the `seo-technical`, `seo-content` and
   `geo-citability` skills on `domain` (and `keyword` if given) — not the
   heavier multi-agent `geo-audit` orchestration, to keep this inside one
   scheduled cycle.
2. **Write `result_md`**: composite assessment in Italian — overall
   impression + the 3-5 most important findings, each with a one-line fix.
3. **Write `meta`**: sub-scores for the dashboard's detail view, e.g.:
   ```json
   { "score_technical": 68, "score_content": 74, "score_ai_citability": 55 }
   ```
4. **Close**:
   ```
   python core/runner_remote.py complete --id <ID> --payload payload.json --domain <this-domain>
   ```
   ```json
   { "id": <ID>, "result_md": "<report>", "meta": { "...": "..." } }
   ```

No new server action: this closes with the same `complete` action used for
`generate`/`revise` tasks (see main `CLAUDE.md` §4.1).
```

- [ ] **Step 6: Create `examples/seo-geo-dashboard-after/domain-config-snippet.json`**

```json
{
  "_comment": "Example block to paste into your cowork_domains.json, under your own domain key. Replace api_url/api_token with your real values.",

  "seo-geo-dashboard": {
    "api_url":   "https://yoursite.com/path/to/seo-geo-dashboard-after/tasks.php",
    "api_token": "PASTE_YOUR_TOKEN_HERE",
    "default":   false,

    "content": {
      "language": "it",
      "notes": "Dashboard di audit SEO/GEO. Un solo action_type: seo_geo_audit, vedi CLAUDE-addendum.md per come eseguirlo e chiuderlo."
    }
  }
}
```

- [ ] **Step 7: Create `examples/seo-geo-dashboard-after/README.md`**

```markdown
# SEO/GEO Audit Dashboard — versione "dopo" (Cowork Connector)

Stessa dashboard della versione ["prima"](../seo-geo-dashboard-before/), ma
la richiesta di analisi non chiama più un'API a pagamento: viene messa
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

## Uso

Inserisci un dominio (e opzionalmente una parola chiave) e premi "Analizza":
il job entra in coda con `action_type: seo_geo_audit`. Compare nella tabella
"Job recenti" una volta **eseguito** (non è istantaneo: serve una sessione
Cowork che lo prenda in carico — vedi `CLAUDE-addendum.md` per come
instradarlo, e la sezione "Esecuzione task schedulati" nel `CLAUDE.md`
principale per come schedularla).

## Diventare una connessione vera

Per usare questa dashboard sul serio (non solo come esempio): segui la
Fase 2/3 del wizard in `CLAUDE.md` (root del progetto) per registrare
`connections/seo-geo-dashboard/NOTES.md` con l'`action_type`
`seo_geo_audit` descritto qui, e la Fase 4 per lo schedule.

## Confronto

Vedi [`examples/seo-geo-dashboard-before/`](../seo-geo-dashboard-before/) per
la versione con chiamata diretta a un'API a pagamento.
```

- [ ] **Step 8: Verify PHP lint**

Run: `php -l "examples/seo-geo-dashboard-after/tasks.php"`
Expected: `No syntax errors detected in examples/seo-geo-dashboard-after/tasks.php`

- [ ] **Step 9: Verify JS syntax**

Run: `node --check "examples/seo-geo-dashboard-after/app.js"`
Expected: no output, exit code 0.

- [ ] **Step 10: End-to-end smoke test against a local PHP server**

Run, from the repo root:
```bash
cd "examples/seo-geo-dashboard-after"
php -S localhost:8091 -t . > /dev/null 2>&1 &
PHP_PID=$!
sleep 1

# 1. No token -> 401
curl -s -o /dev/null -w "unauthorized_status=%{http_code}\n" "http://localhost:8091/tasks.php?action=list"

# 2. Add a job
ADD_RESPONSE=$(curl -s -X POST "http://localhost:8091/tasks.php?action=add" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: CHANGE_THIS_LONG_RANDOM_TOKEN" \
  -d '{"action_type":"seo_geo_audit","prompt":"Esegui un audit SEO e di citabilità AI (GEO) per il dominio esempio.com.","params":{"domain":"esempio.com","keyword":""}}')
echo "add_response=$ADD_RESPONSE"
JOB_ID=$(echo "$ADD_RESPONSE" | grep -o '"id":[0-9]*' | grep -o '[0-9]*')

# 3. Simulate a Cowork session closing the job
curl -s -X POST "http://localhost:8091/tasks.php?action=complete" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: CHANGE_THIS_LONG_RANDOM_TOKEN" \
  -d "{\"id\":$JOB_ID,\"result_md\":\"Punteggio complessivo 65/100.\",\"meta\":{\"score_technical\":68,\"score_content\":74,\"score_ai_citability\":55}}"
echo ""

# 4. Recent should show it as done
curl -s "http://localhost:8091/tasks.php?action=recent&limit=20" -H "X-Auth-Token: CHANGE_THIS_LONG_RANDOM_TOKEN"
echo ""

# 5. Status should return the full result_md and meta
curl -s "http://localhost:8091/tasks.php?action=status&id=$JOB_ID" -H "X-Auth-Token: CHANGE_THIS_LONG_RANDOM_TOKEN"
echo ""

kill $PHP_PID
```

Expected:
- `unauthorized_status=401`
- `add_response` contains `"ok":true` and an `"id"` field
- `recent` output is a JSON array containing one object with `"status": "done"`, `"action_type": "seo_geo_audit"`, and an `"excerpt"` starting with `"Punteggio complessivo 65/100."`
- `status` output contains `"result_md": "Punteggio complessivo 65/100."` and `"meta": {"score_technical": 68, "score_content": 74, "score_ai_citability": 55}` under `task`

- [ ] **Step 11: Clean up runtime artifacts created by the smoke test**

Run:
```bash
cd "examples/seo-geo-dashboard-after"
rm -f cowork_tasks.db cowork_tasks.db-wal cowork_tasks.db-shm
git status --short .
```
Expected: only the 6 files created in Steps 1, 3-7 show as untracked (`??`) — no `.db`/`.db-wal`/`.db-shm` left over.

- [ ] **Step 12: Commit**

```bash
git add examples/seo-geo-dashboard-after/tasks.php examples/seo-geo-dashboard-after/index.html examples/seo-geo-dashboard-after/app.js examples/seo-geo-dashboard-after/CLAUDE-addendum.md examples/seo-geo-dashboard-after/domain-config-snippet.json examples/seo-geo-dashboard-after/README.md
git commit -m "Add seo-geo-dashboard-after example (Cowork Connector queue)"
```

---

## Final check (after all 4 tasks)

- [ ] Run `git status --short examples/` and confirm it is **empty** (everything created by this plan is committed — no stray files under `examples/`).
- [ ] Run `git log --oneline -6` and confirm 4 new commits, one per task, each with a scoped file list (plus the pre-existing spec-doc commit below them).
- [ ] Run `git status --short` from the repo root (no path filter) and confirm every line is one of the files already listed as modified/untracked in this session's very first `git status` (the pre-existing, unrelated i18n work: `CHANGELOG.md`, `CLAUDE.md`, `README.md`, `config/cowork_domains.example.json`, `connections/README.md`, `core/runner_local.py`, `core/runner_remote.py`, `core/tasks.php`, `examples/editorial-content-automation/*`, plus the untracked `.claude/` and `*.it.md`/`*.it.json` files). **Do not `git add` or commit any of these** — they predate this plan and are not part of it; leave them exactly as found.

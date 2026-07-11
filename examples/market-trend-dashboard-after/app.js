const TOKEN_KEY = 'cowork_dashboard_token_market_trend';

const tokenInput = document.getElementById('token');
const saveTokenBtn = document.getElementById('save-token');
const form = document.getElementById('analyze-form');
const targetInput = document.getElementById('target');
const statusEl = document.getElementById('status');
const jobsEl = document.getElementById('jobs');
const detailEl = document.getElementById('detail');
const demoBanner = document.getElementById('demo-banner');
const connPill = document.getElementById('conn-pill');
const connLabel = document.getElementById('conn-label');
const chartWrap = document.getElementById('chart-wrap');
const registryGrid = document.getElementById('registry-grid');
const tickerTarget = document.getElementById('ticker-target');
const tickerScore = document.getElementById('ticker-score');
const tickerDelta = document.getElementById('ticker-delta');

// ---- demo dataset: shown until a real token + real jobs are available.
// Several entries share the same target on purpose, so the "Registro per
// target" section below has real history to group and show a trend on. ----
const DEMO_JOBS = [
  {
    id: 'demo-1', action_type: 'market_trend', status: 'done',
    finished_at: '2026-07-10 08:14', target: 'BTC',
    excerpt: 'BTC in trend rialzista, sentiment positivo trainato da volumi social in crescita.',
    meta: { score: 72, sentiment: 'positivo', social_volume: 18400, price_change_24h: 3.2 },
    result_md: '## Sintesi\nBTC mostra un trend rialzista di breve periodo, con volumi social in aumento del 22% nelle ultime 24h.\n\n## Metriche chiave\n- Score complessivo: 72/100\n- Sentiment: positivo (68% menzioni)\n- Volume sociale: 18.400 interazioni\n- Variazione prezzo 24h: +3.2%\n\n## Highlight\n- Diversi creator con audience ampia hanno pubblicato analisi tecniche rialziste.\n- Il volume di menzioni supera la media mobile a 7 giorni.',
  },
  {
    id: 'demo-2', action_type: 'market_trend', status: 'done',
    finished_at: '2026-07-09 10:05', target: 'BTC',
    excerpt: 'BTC in consolidamento, sentiment ancora positivo ma volumi in leggero calo.',
    meta: { score: 68, sentiment: 'positivo', social_volume: 16200, price_change_24h: 2.1 },
    result_md: '## Sintesi\nBTC consolida i guadagni della settimana, sentiment ancora positivo.\n\n## Metriche chiave\n- Score complessivo: 68/100\n- Sentiment: positivo\n- Volume sociale: 16.200 interazioni\n- Variazione prezzo 24h: +2.1%',
  },
  {
    id: 'demo-3', action_type: 'market_trend', status: 'done',
    finished_at: '2026-07-07 09:00', target: 'BTC',
    excerpt: 'BTC laterale, sentiment neutro.',
    meta: { score: 61, sentiment: 'neutro', social_volume: 12000, price_change_24h: -0.4 },
    result_md: '## Sintesi\nBTC in fase laterale, nessun catalizzatore evidente nelle ultime 24h.\n\n## Metriche chiave\n- Score complessivo: 61/100\n- Sentiment: neutro\n- Volume sociale: 12.000 interazioni\n- Variazione prezzo 24h: -0.4%',
  },
  {
    id: 'demo-4', action_type: 'market_trend', status: 'done',
    finished_at: '2026-07-09 19:40', target: '"agentic AI"',
    excerpt: 'Interesse in crescita costante, sentiment neutro-positivo, nessun picco anomalo.',
    meta: { score: 65, sentiment: 'neutro-positivo', social_volume: 9100 },
    result_md: '## Sintesi\nLa conversazione intorno ad "agentic AI" cresce in modo costante, senza picchi speculativi.\n\n## Metriche chiave\n- Score complessivo: 65/100\n- Sentiment: neutro-positivo\n- Volume sociale: 9.100 interazioni\n\n## Highlight\n- Crescita organica trainata da contenuti tecnici/educational, non da hype.\n- Nessun segnale di volume artificiale.',
  },
  {
    id: 'demo-5', action_type: 'market_trend', status: 'done',
    finished_at: '2026-07-06 12:00', target: '"agentic AI"',
    excerpt: 'Volumi ancora contenuti, sentiment neutro.',
    meta: { score: 58, sentiment: 'neutro', social_volume: 7200 },
    result_md: '## Sintesi\nPrimo controllo su "agentic AI": conversazione ancora di nicchia, in crescita lenta.\n\n## Metriche chiave\n- Score complessivo: 58/100\n- Sentiment: neutro\n- Volume sociale: 7.200 interazioni',
  },
  {
    id: 'demo-6', action_type: 'market_trend', status: 'running',
    finished_at: '', target: 'ETH', excerpt: '',
  },
  {
    id: 'demo-7', action_type: 'market_trend', status: 'error',
    finished_at: '2026-07-08 11:02', target: 'SOL',
    excerpt: 'Errore: dati social insufficienti per il periodo richiesto.',
  },
];

let usingDemo = true;
let currentRegistry = [];
const detailCache = new Map();

tokenInput.value = localStorage.getItem(TOKEN_KEY) || '';

saveTokenBtn.addEventListener('click', () => {
  localStorage.setItem(TOKEN_KEY, tokenInput.value.trim());
  statusEl.textContent = 'Token salvato.';
  detailCache.clear();
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

// Minimal markdown-ish renderer: ## headings, - bullet lists, paragraphs.
function renderMarkdown(md) {
  if (!md) return '<p class="placeholder">(nessun risultato)</p>';
  const lines = md.split('\n');
  let html = '';
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { if (inList) { html += '</ul>'; inList = false; } continue; }
    if (line.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h4>${escapeHtml(line.slice(3))}</h4>`;
    } else if (line.startsWith('- ')) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${escapeHtml(line.slice(2))}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p>${escapeHtml(line)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
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
    statusEl.textContent = 'Imposta prima il token (vedi Impostazioni) per inviare un job reale.';
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

// Fetches (and caches) full task detail for a job coming from `recent`, which
// only exposes id/status/finished_at/excerpt — target/meta/result_md live in
// `status`. Finished jobs are cached forever; running/pending ones are
// re-fetched every poll since their result can still change.
async function fetchDetail(job) {
  const cached = detailCache.get(job.id);
  if (cached && job.status !== 'running' && job.status !== 'pending') return cached;
  try {
    const data = await api(`action=status&id=${job.id}`, { method: 'GET' });
    const t = data.task;
    const merged = {
      id: t.id, status: t.status, target: (t.meta && t.meta.target) || '',
      finished_at: job.finished_at, excerpt: job.excerpt, meta: t.meta, result_md: t.result_md,
    };
    detailCache.set(job.id, merged);
    return merged;
  } catch {
    return { id: job.id, status: job.status, target: '', finished_at: job.finished_at, excerpt: job.excerpt };
  }
}

async function loadJobs() {
  if (!getToken()) {
    applyJobs(DEMO_JOBS, true);
    return;
  }
  try {
    const jobs = await api('action=recent&limit=20', { method: 'GET' });
    if (!Array.isArray(jobs) || jobs.length === 0) {
      applyJobs(DEMO_JOBS, true);
      return;
    }
    const detailed = await Promise.all(jobs.map(fetchDetail));
    applyJobs(detailed, false);
  } catch (err) {
    jobsEl.innerHTML = `<p class="placeholder">Impossibile contattare tasks.php (${escapeHtml(err.message)}) — mostro dati di esempio.</p>`;
    applyJobs(DEMO_JOBS, true);
  }
}

function applyJobs(jobs, isDemo) {
  setDemoMode(isDemo);
  renderJobs(jobs, isDemo);
  currentRegistry = buildRegistry(jobs);
  renderRegistry(currentRegistry);
  const latestDone = jobs.find((j) => j.status === 'done');
  if (latestDone) selectJob(latestDone);
}

function setDemoMode(isDemo) {
  usingDemo = isDemo;
  demoBanner.classList.toggle('show', isDemo);
  connPill.className = 'pill ' + (isDemo ? 'demo' : 'live');
  connLabel.textContent = isDemo ? 'Modalità demo' : 'Connesso';
}

function statusBadge(status) {
  const label = { done: 'completato', running: 'in corso', error: 'errore', pending: 'in coda' }[status] || status;
  return `<span class="badge ${escapeHtml(status)}">${escapeHtml(label)}</span>`;
}

function renderJobs(jobs, isDemo) {
  const rows = jobs.map((job) => `
    <tr data-id="${job.id}" class="job-row">
      <td>${escapeHtml(String(job.id).replace('demo-', '#'))}</td>
      <td>${escapeHtml(job.target || job.action_type || '—')}</td>
      <td>${statusBadge(job.status)}</td>
      <td>${escapeHtml(job.finished_at || '—')}</td>
      <td>${escapeHtml(job.excerpt || '—')}</td>
    </tr>
  `).join('');
  jobsEl.innerHTML = `
    <table>
      <thead><tr><th>ID</th><th>Target</th><th>Stato</th><th>Completato</th><th>Estratto</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  jobsEl.querySelectorAll('.job-row').forEach((row) => {
    row.addEventListener('click', () => {
      const id = row.dataset.id;
      const job = jobs.find((j) => String(j.id) === id);
      if (job) selectJob(job);
    });
  });
}

// Groups jobs by target to build the "Registro per target" — how many runs,
// latest score, trend vs. the previous run, and the score history used for
// the overview chart. Input is assumed newest-first (matches DEMO_JOBS and
// the `recent` endpoint).
function buildRegistry(jobs) {
  const chronological = [...jobs].reverse();
  const byTarget = new Map();
  for (const job of chronological) {
    if (!job.target) continue;
    if (!byTarget.has(job.target)) byTarget.set(job.target, []);
    byTarget.get(job.target).push(job);
  }
  const list = [];
  for (const [key, entries] of byTarget.entries()) {
    const scored = entries.filter((e) => e.meta && e.meta.score != null).map((e) => e.meta.score);
    const last = entries[entries.length - 1];
    const latestScore = scored.length ? scored[scored.length - 1] : null;
    const prevScore = scored.length > 1 ? scored[scored.length - 2] : null;
    list.push({
      key,
      count: entries.length,
      latestScore,
      trend: (latestScore != null && prevScore != null) ? Math.round((latestScore - prevScore) * 10) / 10 : null,
      lastStatus: last.status,
      lastDate: last.finished_at,
      history: scored,
      lastJob: last,
    });
  }
  list.sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''));
  return list;
}

function renderRegistry(list) {
  if (!list.length) {
    registryGrid.innerHTML = '<div class="registry-empty">Nessuna analisi ancora registrata.</div>';
    return;
  }
  registryGrid.innerHTML = list.map((site) => {
    const scoreDisplay = site.latestScore != null ? site.latestScore : (site.lastStatus === 'running' ? '···' : '—');
    const trendHtml = site.trend != null
      ? `<span class="rc-trend ${site.trend >= 0 ? 'up' : 'down'}">${site.trend >= 0 ? '▲' : '▼'} ${Math.abs(site.trend)}</span>`
      : '';
    return `
      <button class="registry-card" data-key="${escapeHtml(site.key)}" type="button">
        <div class="rc-name">${escapeHtml(site.key)}</div>
        <div class="rc-score-row"><span class="rc-score">${escapeHtml(String(scoreDisplay))}</span>${trendHtml}</div>
        <div class="rc-meta">${site.count} ${site.count === 1 ? 'analisi' : 'analisi'} · ultima ${escapeHtml(site.lastDate || 'in corso')}</div>
      </button>
    `;
  }).join('');
  registryGrid.querySelectorAll('.registry-card').forEach((card) => {
    card.addEventListener('click', () => {
      const site = list.find((s) => s.key === card.dataset.key);
      if (site) selectJob(site.lastJob);
    });
  });
}

function selectJob(job) {
  if (job.meta !== undefined || job.result_md !== undefined) {
    renderDetail(job);
    return;
  }
  fetchDetail(job).then(renderDetail).catch((err) => {
    detailEl.innerHTML = `<p class="placeholder">Errore nel caricare il dettaglio: ${escapeHtml(err.message)}</p>`;
  });
}

function renderDetail(job) {
  const meta = job.meta || {};
  const metaEntries = Object.entries(meta).filter(([k]) => k !== 'target');
  const metaHtml = metaEntries.length
    ? `<div class="meta-list">${metaEntries.map(([k, v]) => `<span>${escapeHtml(k)}: ${escapeHtml(v)}</span>`).join('')}</div>`
    : '';
  detailEl.innerHTML = `
    <h3>${escapeHtml(job.target || ('Job #' + job.id))}</h3>
    ${metaHtml}
    <div class="report">${renderMarkdown(job.result_md)}</div>
  `;
  updateOverview(job);
}

function updateOverview(job) {
  const meta = job.meta || {};
  const scoreEl = document.getElementById('stat-score');
  const sentimentEl = document.getElementById('stat-sentiment');
  const volumeEl = document.getElementById('stat-volume');
  const deltaEl = document.getElementById('stat-delta');

  scoreEl.textContent = meta.score != null ? meta.score : '—';
  sentimentEl.textContent = meta.sentiment || '—';
  volumeEl.textContent = meta.social_volume != null ? Number(meta.social_volume).toLocaleString('it-IT') : '—';

  if (meta.price_change_24h != null) {
    const up = meta.price_change_24h >= 0;
    deltaEl.textContent = `${up ? '▲' : '▼'} ${Math.abs(meta.price_change_24h)}%`;
    deltaEl.className = 'value ' + (up ? 'positive' : 'negative');
  } else {
    deltaEl.textContent = '—';
    deltaEl.className = 'value';
  }

  tickerTarget.textContent = job.target || '—';
  tickerScore.textContent = meta.score != null ? meta.score : '—';
  if (meta.price_change_24h != null) {
    const up = meta.price_change_24h >= 0;
    tickerDelta.innerHTML = `<span class="${up ? 'delta-up' : 'delta-down'}">${up ? '▲' : '▼'} ${Math.abs(meta.price_change_24h)}%</span>`;
  } else {
    tickerDelta.textContent = meta.sentiment || '—';
  }

  const entry = currentRegistry.find((s) => s.key === job.target);
  renderChart(entry ? entry.history : []);
}

function renderChart(history) {
  if (!Array.isArray(history) || history.length < 2) {
    chartWrap.innerHTML = '<div id="chart-empty">Servono almeno due analisi dello stesso target per un grafico — vedi il Registro per lo storico.</div>';
    return;
  }
  const w = 600, h = 140, pad = 10;
  const min = Math.min(...history), max = Math.max(...history);
  const range = max - min || 1;
  const step = (w - pad * 2) / (history.length - 1);
  const points = history.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = points[points.length - 1].split(',');
  chartWrap.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <polyline points="${points.join(' ')}" fill="none" stroke="#d4a24c" stroke-width="2" />
      <circle cx="${last[0]}" cy="${last[1]}" r="3.5" fill="#d4a24c" />
    </svg>
  `;
}

loadJobs();
setInterval(loadJobs, 15000);

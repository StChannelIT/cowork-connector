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
const tickerTarget = document.getElementById('ticker-target');
const tickerScore = document.getElementById('ticker-score');
const tickerDelta = document.getElementById('ticker-delta');

// ---- demo dataset: shown until a real token + real jobs are available ----
const DEMO_JOBS = [
  {
    id: 'demo-1', action_type: 'market_trend', status: 'done',
    finished_at: '2026-07-10 08:14', target: 'BTC',
    excerpt: 'BTC in trend rialzista, sentiment positivo trainato da volumi social in crescita.',
    meta: { score: 72, sentiment: 'positivo', social_volume: 18400, price_change_24h: 3.2, score_history: [58, 61, 64, 68, 70, 72] },
    result_md: '## Sintesi\nBTC mostra un trend rialzista di breve periodo, con volumi social in aumento del 22% nelle ultime 24h.\n\n## Metriche chiave\n- Score complessivo: 72/100\n- Sentiment: positivo (68% menzioni)\n- Volume sociale: 18.400 interazioni\n- Variazione prezzo 24h: +3.2%\n\n## Highlight\n- Diversi creator con audience ampia hanno pubblicato analisi tecniche rialziste.\n- Il volume di menzioni supera la media mobile a 7 giorni.',
  },
  {
    id: 'demo-2', action_type: 'market_trend', status: 'done',
    finished_at: '2026-07-09 19:40', target: '"agentic AI"',
    excerpt: 'Interesse in crescita costante, sentiment neutro-positivo, nessun picco anomalo.',
    meta: { score: 65, sentiment: 'neutro-positivo', social_volume: 9100, score_history: [51, 55, 58, 61, 63, 65] },
    result_md: '## Sintesi\nLa conversazione intorno ad "agentic AI" cresce in modo costante, senza picchi speculativi.\n\n## Metriche chiave\n- Score complessivo: 65/100\n- Sentiment: neutro-positivo\n- Volume sociale: 9.100 interazioni\n\n## Highlight\n- Crescita organica trainata da contenuti tecnici/educational, non da hype.\n- Nessun segnale di volume artificiale.',
  },
  {
    id: 'demo-3', action_type: 'market_trend', status: 'running',
    finished_at: '', target: 'ETH', excerpt: '',
  },
  {
    id: 'demo-4', action_type: 'market_trend', status: 'error',
    finished_at: '2026-07-08 11:02', target: 'SOL',
    excerpt: 'Errore: dati social insufficienti per il periodo richiesto.',
  },
];

let usingDemo = true;

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

async function loadJobs() {
  if (!getToken()) {
    setDemoMode(true);
    renderJobs(DEMO_JOBS);
    selectJob(DEMO_JOBS[0]);
    return;
  }
  try {
    const jobs = await api('action=recent&limit=20', { method: 'GET' });
    if (!Array.isArray(jobs) || jobs.length === 0) {
      setDemoMode(true);
      renderJobs(DEMO_JOBS);
      selectJob(DEMO_JOBS[0]);
      return;
    }
    setDemoMode(false);
    renderJobs(jobs);
    const latestDone = jobs.find((j) => j.status === 'done');
    if (latestDone) await selectJob(latestDone);
  } catch (err) {
    setDemoMode(true);
    jobsEl.innerHTML = `<p class="placeholder">Impossibile contattare tasks.php (${escapeHtml(err.message)}) — mostro dati di esempio.</p>`;
    renderJobs(DEMO_JOBS);
    selectJob(DEMO_JOBS[0]);
  }
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

function renderJobs(jobs) {
  const rows = jobs.map((job) => `
    <tr data-id="${job.id}" class="job-row">
      <td>${escapeHtml(String(job.id).replace('demo-', '#'))}</td>
      <td>${escapeHtml(job.target || job.action_type)}</td>
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
    row.addEventListener('click', async () => {
      const id = row.dataset.id;
      if (usingDemo) {
        const job = DEMO_JOBS.find((j) => String(j.id) === id);
        if (job) selectJob(job);
      } else {
        await selectJob({ id });
      }
    });
  });
}

async function selectJob(job) {
  if (String(job.id).startsWith('demo-')) {
    renderDetail(job);
    return;
  }
  try {
    const data = await api(`action=status&id=${job.id}`, { method: 'GET' });
    const t = data.task;
    renderDetail({
      id: t.id,
      status: t.status,
      target: (t.meta && t.meta.target) || '',
      meta: t.meta,
      result_md: t.result_md,
    });
  } catch (err) {
    detailEl.innerHTML = `<p class="placeholder">Errore nel caricare il dettaglio: ${escapeHtml(err.message)}</p>`;
  }
}

function renderDetail(job) {
  const meta = job.meta || {};
  const metaEntries = Object.entries(meta).filter(([k]) => k !== 'score_history');
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

  renderChart(meta.score_history);
}

function renderChart(history) {
  if (!Array.isArray(history) || history.length < 2) {
    chartWrap.innerHTML = '<div id="chart-empty">Cronologia punteggio non disponibile per questo target.</div>';
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

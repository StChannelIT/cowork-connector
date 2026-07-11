const TOKEN_KEY = 'cowork_dashboard_token_seo_geo';

const tokenInput = document.getElementById('token');
const saveTokenBtn = document.getElementById('save-token');
const form = document.getElementById('analyze-form');
const domainInput = document.getElementById('domain');
const keywordInput = document.getElementById('keyword');
const statusEl = document.getElementById('status');
const jobsEl = document.getElementById('jobs');
const detailEl = document.getElementById('detail');
const findingsEl = document.getElementById('findings');
const demoBanner = document.getElementById('demo-banner');
const connPill = document.getElementById('conn-pill');
const connLabel = document.getElementById('conn-label');
const registryGrid = document.getElementById('registry-grid');
const barDomain = document.getElementById('bar-domain');
const barGrade = document.getElementById('bar-grade');
const barDate = document.getElementById('bar-date');

// ---- demo dataset: shown until a real token + real jobs are available.
// esempio.com has three runs on purpose, oldest to newest, showing a site
// that improved after acting on earlier findings — the "Registro per sito"
// section groups these into one card with a run count and a trend. ----
const DEMO_JOBS = [
  {
    id: 'demo-1', action_type: 'seo_geo_audit', status: 'done',
    finished_at: '2026-07-10 07:52', domain: 'esempio.com',
    excerpt: 'Punteggio complessivo 82/100. Ottima base tecnica e strutturata.',
    meta: {
      domain: 'esempio.com', score_technical: 82, score_content: 88, score_ai_citability: 76,
      findings: [
        { severity: 'pass', text: 'Schema Organization e Article presenti e validi su tutte le pagine controllate.' },
        { severity: 'pass', text: 'llms.txt presente e aggiornato.' },
        { severity: 'warn', text: 'First Contentful Paint sopra soglia su mobile (2.8s).' },
      ],
    },
    result_md: '## Impressione generale\nBuona base tecnica e contenuti ben strutturati; margine di miglioramento sulle performance mobile. Netto miglioramento rispetto ai due audit precedenti.\n\n## Punteggi\n- Tecnico: 82/100\n- Contenuto: 88/100\n- Citabilità AI: 76/100\n\n## Priorità\n- Ottimizzare il caricamento immagini above-the-fold su mobile.',
  },
  {
    id: 'demo-2', action_type: 'seo_geo_audit', status: 'done',
    finished_at: '2026-07-08 10:30', domain: 'esempio.com',
    excerpt: 'Punteggio complessivo 59/100. Corretti alcuni rilievi tecnici, restano lacune di contenuto.',
    meta: {
      domain: 'esempio.com', score_technical: 60, score_content: 66, score_ai_citability: 50,
      findings: [
        { severity: 'fail', text: 'Manca ancora il file llms.txt.' },
        { severity: 'warn', text: 'Meta description assente su 4 pagine su 10 controllate.' },
        { severity: 'warn', text: 'JSON-LD Article presente solo sulla home.' },
        { severity: 'pass', text: 'Robots.txt corretto dopo la modifica suggerita nell\'audit precedente.' },
      ],
    },
    result_md: '## Impressione generale\nMiglioramento rispetto al primo audit: il blocco robots.txt è stato rimosso. Restano lacune sui segnali di citabilità AI.\n\n## Punteggi\n- Tecnico: 60/100\n- Contenuto: 66/100\n- Citabilità AI: 50/100\n\n## Priorità\n- Aggiungere llms.txt in root.\n- Estendere JSON-LD Article a tutte le pagine principali.',
  },
  {
    id: 'demo-3', action_type: 'seo_geo_audit', status: 'done',
    finished_at: '2026-07-05 09:00', domain: 'esempio.com',
    excerpt: 'Punteggio complessivo 44/100. Diversi problemi tecnici e nessun segnale di citabilità AI.',
    meta: {
      domain: 'esempio.com', score_technical: 45, score_content: 50, score_ai_citability: 38,
      findings: [
        { severity: 'fail', text: 'Robots.txt blocca involontariamente i crawler AI.' },
        { severity: 'fail', text: 'Manca il file llms.txt.' },
        { severity: 'fail', text: 'Nessun markup JSON-LD su tutto il sito.' },
        { severity: 'warn', text: 'Meta description assente su 8 pagine su 10 controllate.' },
      ],
    },
    result_md: '## Impressione generale\nPrimo audit: diversi problemi tecnici bloccano di fatto la citabilità da parte di assistenti AI.\n\n## Punteggi\n- Tecnico: 45/100\n- Contenuto: 50/100\n- Citabilità AI: 38/100\n\n## Priorità\n- Correggere subito il blocco robots.txt sui crawler AI.\n- Aggiungere llms.txt e markup JSON-LD di base.',
  },
  {
    id: 'demo-4', action_type: 'seo_geo_audit', status: 'running',
    finished_at: '', domain: 'altrodominio.it', excerpt: '',
  },
  {
    id: 'demo-5', action_type: 'seo_geo_audit', status: 'error',
    finished_at: '2026-07-08 09:30', domain: 'terzodominio.com',
    excerpt: 'Errore: dominio non raggiungibile durante la scansione.',
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
  const domain = domainInput.value.trim();
  const keyword = keywordInput.value.trim();
  if (!domain) return;
  if (!getToken()) {
    statusEl.textContent = 'Imposta prima il token (vedi Impostazioni) per inviare un job reale.';
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

// Fetches (and caches) full task detail for a job coming from `recent`, which
// only exposes id/status/finished_at/excerpt — domain/meta/result_md live in
// `status`. Finished jobs are cached forever; running/pending ones are
// re-fetched every poll since their result can still change.
async function fetchDetail(job) {
  const cached = detailCache.get(job.id);
  if (cached && job.status !== 'running' && job.status !== 'pending') return cached;
  try {
    const data = await api(`action=status&id=${job.id}`, { method: 'GET' });
    const t = data.task;
    const merged = {
      id: t.id, status: t.status, domain: (t.meta && t.meta.domain) || '',
      finished_at: job.finished_at, excerpt: job.excerpt, meta: t.meta, result_md: t.result_md,
    };
    detailCache.set(job.id, merged);
    return merged;
  } catch {
    return { id: job.id, status: job.status, domain: '', finished_at: job.finished_at, excerpt: job.excerpt };
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
  renderJobs(jobs);
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

function renderJobs(jobs) {
  const rows = jobs.map((job) => `
    <tr data-id="${job.id}" class="job-row">
      <td>${escapeHtml(String(job.id).replace('demo-', '#'))}</td>
      <td>${escapeHtml(job.domain || job.action_type || '—')}</td>
      <td>${statusBadge(job.status)}</td>
      <td>${escapeHtml(job.finished_at || '—')}</td>
      <td>${escapeHtml(job.excerpt || '—')}</td>
    </tr>
  `).join('');
  jobsEl.innerHTML = `
    <table>
      <thead><tr><th>ID</th><th>Dominio</th><th>Stato</th><th>Completato</th><th>Estratto</th></tr></thead>
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

function averageScore(meta) {
  if (!meta) return null;
  const { score_technical: t, score_content: c, score_ai_citability: a } = meta;
  if (t == null || c == null || a == null) return null;
  return Math.round((t + c + a) / 3);
}

// Groups jobs by domain to build the "Registro per sito" — how many audits,
// latest grade, trend vs. the previous audit. Input is assumed newest-first
// (matches DEMO_JOBS and the `recent` endpoint).
function buildRegistry(jobs) {
  const chronological = [...jobs].reverse();
  const byDomain = new Map();
  for (const job of chronological) {
    if (!job.domain) continue;
    if (!byDomain.has(job.domain)) byDomain.set(job.domain, []);
    byDomain.get(job.domain).push(job);
  }
  const list = [];
  for (const [key, entries] of byDomain.entries()) {
    const scored = entries
      .map((e) => ({ job: e, avg: averageScore(e.meta) }))
      .filter((e) => e.avg != null);
    const last = entries[entries.length - 1];
    const latestAvg = scored.length ? scored[scored.length - 1].avg : null;
    const prevAvg = scored.length > 1 ? scored[scored.length - 2].avg : null;
    list.push({
      key,
      count: entries.length,
      latestAvg,
      grade: latestAvg != null ? gradeFromAverage(latestAvg) : null,
      trend: (latestAvg != null && prevAvg != null) ? latestAvg - prevAvg : null,
      lastStatus: last.status,
      lastDate: last.finished_at,
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
    const gradeDisplay = site.grade ? site.grade.letter : (site.lastStatus === 'running' ? '···' : '—');
    const gradeTier = site.grade ? site.grade.tier : '';
    const trendHtml = site.trend != null
      ? `<span class="rc-trend ${site.trend >= 0 ? 'up' : 'down'}">${site.trend >= 0 ? '▲' : '▼'} ${Math.abs(site.trend)}</span>`
      : '';
    return `
      <button class="registry-card" data-key="${escapeHtml(site.key)}" type="button">
        <div class="rc-name">${escapeHtml(site.key)}</div>
        <div class="rc-score-row"><span class="rc-grade ${gradeTier}">${escapeHtml(gradeDisplay)}</span>${trendHtml}</div>
        <div class="rc-meta">${site.count} ${site.count === 1 ? 'audit' : 'audit'} · ultimo ${escapeHtml(site.lastDate || 'in corso')}</div>
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
  const metaEntries = Object.entries(meta).filter(([k]) => k !== 'findings' && k !== 'domain');
  const metaHtml = metaEntries.length
    ? `<div class="meta-list">${metaEntries.map(([k, v]) => `<span>${escapeHtml(k)}: ${escapeHtml(v)}</span>`).join('')}</div>`
    : '';
  detailEl.innerHTML = `
    <h3>${escapeHtml(job.domain || ('Job #' + job.id))}</h3>
    ${metaHtml}
    <div class="report">${renderMarkdown(job.result_md)}</div>
  `;
  updateOverview(job);
}

function tierForScore(score) {
  if (score >= 70) return 'pass';
  if (score >= 50) return 'warn';
  return 'fail';
}

function gradeFromAverage(avg) {
  if (avg >= 90) return { letter: 'A', tier: 'pass' };
  if (avg >= 75) return { letter: 'B', tier: 'pass' };
  if (avg >= 55) return { letter: 'C', tier: 'warn' };
  if (avg >= 40) return { letter: 'D', tier: 'warn' };
  return { letter: 'F', tier: 'fail' };
}

function setBar(key, score) {
  const tier = tierForScore(score);
  document.getElementById(`bar-${key}`).style.width = `${score}%`;
  document.getElementById(`bar-${key}`).className = `bar-fill ${tier}`;
  document.getElementById(`val-${key}`).textContent = score;
  const tick = document.getElementById(`tick-${key}`);
  tick.className = `bar-tick ${tier}`;
  tick.textContent = tier === 'pass' ? '✓' : tier === 'warn' ? '⚠' : '✕';
}

function updateOverview(job) {
  const meta = job.meta || {};
  const { score_technical: t, score_content: c, score_ai_citability: a } = meta;

  const gradeLetterEl = document.getElementById('grade-letter');
  const gradeScoreEl = document.getElementById('grade-score');

  if (t != null && c != null && a != null) {
    setBar('technical', t);
    setBar('content', c);
    setBar('ai', a);
    const avg = Math.round((t + c + a) / 3);
    const grade = gradeFromAverage(avg);
    gradeLetterEl.textContent = grade.letter;
    gradeLetterEl.className = `letter ${grade.tier}`;
    gradeScoreEl.textContent = `${avg}/100`;
    barGrade.textContent = grade.letter;
    barGrade.className = `grade-chip ${grade.tier}`;
  } else {
    ['technical', 'content', 'ai'].forEach((key) => {
      document.getElementById(`bar-${key}`).style.width = '0%';
      document.getElementById(`val-${key}`).textContent = '—';
      document.getElementById(`tick-${key}`).textContent = '';
    });
    gradeLetterEl.textContent = '—';
    gradeLetterEl.className = 'letter';
    gradeScoreEl.textContent = '—/100';
    barGrade.textContent = '—';
    barGrade.className = 'grade-chip';
  }

  barDomain.textContent = job.domain || '—';
  barDate.textContent = job.finished_at || '—';

  const findings = meta.findings;
  if (Array.isArray(findings) && findings.length) {
    findingsEl.innerHTML = findings.map((f) => `
      <div class="finding-row">
        <span class="tick ${escapeHtml(f.severity)}">${f.severity === 'pass' ? '✓' : f.severity === 'warn' ? '⚠' : '✕'}</span>
        <span>${escapeHtml(f.text)}</span>
      </div>
    `).join('');
  } else {
    findingsEl.innerHTML = '<div class="findings-empty">Nessun rilievo ancora.</div>';
  }
}

loadJobs();
setInterval(loadJobs, 15000);

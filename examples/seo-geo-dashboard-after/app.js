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
const barDomain = document.getElementById('bar-domain');
const barGrade = document.getElementById('bar-grade');
const barDate = document.getElementById('bar-date');

// ---- demo dataset: shown until a real token + real jobs are available ----
const DEMO_JOBS = [
  {
    id: 'demo-1', action_type: 'seo_geo_audit', status: 'done',
    finished_at: '2026-07-10 07:52', domain: 'esempio.com',
    excerpt: 'Punteggio complessivo 66/100. Manca llms.txt, meta description incomplete.',
    meta: {
      domain: 'esempio.com', score_technical: 68, score_content: 74, score_ai_citability: 55,
      findings: [
        { severity: 'fail', text: 'Manca il file llms.txt — i crawler AI non hanno una mappa esplicita dei contenuti.' },
        { severity: 'warn', text: 'Meta description assente su 6 pagine su 10 controllate.' },
        { severity: 'warn', text: 'Nessun markup Article/Organization in JSON-LD.' },
        { severity: 'pass', text: 'Robots.txt corretto, nessun blocco involontario ai crawler AI.' },
      ],
    },
    result_md: '## Impressione generale\nSito tecnicamente solido ma poco preparato per la citazione da parte di assistenti AI: mancano segnali strutturati chiave.\n\n## Punteggi\n- Tecnico: 68/100\n- Contenuto: 74/100\n- Citabilità AI: 55/100\n\n## Priorità\n- Aggiungere llms.txt in root.\n- Completare le meta description mancanti.\n- Introdurre JSON-LD Article/Organization sulle pagine principali.',
  },
  {
    id: 'demo-2', action_type: 'seo_geo_audit', status: 'done',
    finished_at: '2026-07-09 21:10', domain: 'esempio.com', keyword: '"agentic AI"',
    excerpt: 'Punteggio complessivo 82/100. Ottima base tecnica e strutturata.',
    meta: {
      domain: 'esempio.com', score_technical: 82, score_content: 88, score_ai_citability: 76,
      findings: [
        { severity: 'pass', text: 'Schema Organization e Article presenti e validi su tutte le pagine controllate.' },
        { severity: 'pass', text: 'llms.txt presente e aggiornato.' },
        { severity: 'warn', text: 'First Contentful Paint sopra soglia su mobile (2.8s).' },
      ],
    },
    result_md: '## Impressione generale\nBuona base tecnica e contenuti ben strutturati; margine di miglioramento sulle performance mobile.\n\n## Punteggi\n- Tecnico: 82/100\n- Contenuto: 88/100\n- Citabilità AI: 76/100\n\n## Priorità\n- Ottimizzare il caricamento immagini above-the-fold su mobile.',
  },
  {
    id: 'demo-3', action_type: 'seo_geo_audit', status: 'running',
    finished_at: '', domain: 'altrodominio.it', excerpt: '',
  },
  {
    id: 'demo-4', action_type: 'seo_geo_audit', status: 'error',
    finished_at: '2026-07-08 09:30', domain: 'terzodominio.com',
    excerpt: 'Errore: dominio non raggiungibile durante la scansione.',
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
      <td>${escapeHtml(job.domain || job.action_type)}</td>
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
      domain: (t.meta && t.meta.domain) || '',
      finished_at: t.finished_at,
      meta: t.meta,
      result_md: t.result_md,
    });
  } catch (err) {
    detailEl.innerHTML = `<p class="placeholder">Errore nel caricare il dettaglio: ${escapeHtml(err.message)}</p>`;
  }
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

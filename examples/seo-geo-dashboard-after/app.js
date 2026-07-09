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
  if (!getToken()) {
    jobsEl.innerHTML = '<p>Imposta il token per vedere i job.</p>';
    return;
  }
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

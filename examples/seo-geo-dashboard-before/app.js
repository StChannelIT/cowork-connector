// Placeholder configuration for a typical "give the dashboard a paid API key" setup.
// Replace these with your real provider's endpoint and key to make this version work for real.
const API_URL = 'https://api.example.com/v1/chat/completions';
const API_KEY = 'YOUR_API_KEY_HERE';

const form = document.getElementById('analyze-form');
const domainInput = document.getElementById('domain');
const keywordInput = document.getElementById('keyword');
const resultEl = document.getElementById('result');
const statusEl = document.getElementById('status');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Minimal markdown-ish renderer: ## headings, - bullet lists, paragraphs.
function renderMarkdown(md) {
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

// Illustrative fallback shown when API_URL/API_KEY are still placeholders (the default
// state of this example). Clearly labeled as such — not a real analysis.
function placeholderReport(domain, keyword) {
  const focus = keyword ? ` (focus: "${keyword}")` : '';
  return `## Impressione generale\nEsempio di come apparirebbe un audit per ${domain}${focus}: punteggio complessivo nella media, alcuni rilievi tecnici da correggere.\n\n## Punteggi\n- Tecnico: 64/100\n- Contenuto: 70/100\n- Citabilità AI: 52/100 (stimato)`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const domain = domainInput.value.trim();
  const keyword = keywordInput.value.trim();
  if (!domain) return;

  statusEl.textContent = 'Analisi in corso...';
  resultEl.innerHTML = '<div class="placeholder">Attendere...</div>';

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
    resultEl.innerHTML = `<div class="report">${renderMarkdown(text)}</div>`;
  } catch (err) {
    statusEl.textContent = 'Nessuna chiamata reale eseguita — vedi la nota qui sotto.';
    resultEl.innerHTML = `
      <div class="report">${renderMarkdown(placeholderReport(domain, keyword))}</div>
      <div class="config-note">Questo è l'esempio "prima": <code>API_URL</code>/<code>API_KEY</code> in <code>app.js</code> sono segnaposto, quindi il report qui sopra è illustrativo, non una vera chiamata. Sostituiscili con le credenziali reali di un provider AI a pagamento per far funzionare questa versione, oppure guarda <a href="../seo-geo-dashboard-after/">seo-geo-dashboard-after</a> per il flusso basato sulla coda del Cowork Connector.</div>
    `;
  }
});

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

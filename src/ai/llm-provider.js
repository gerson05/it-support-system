/**
 * LLM Provider abstraction — swap the AI brain via env vars, never hardcoded.
 *
 * Config (.env):
 *   LLM_PROVIDER    = claude | openai | gemini | ollama   (default: none / disabled)
 *   LLM_API_KEY     = sk-...                               (not needed for ollama)
 *   LLM_MODEL       = claude-sonnet-4-6 | gpt-4o | ...    (provider default if omitted)
 *   LLM_BASE_URL    = http://localhost:11434               (ollama only)
 *   EMBEDDING_MODEL = nomic-embed-text | ...               (embedding model override)
 */

const DEFAULTS = {
  claude: 'claude-sonnet-4-6',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-1.5-flash',
  ollama: 'llama3.2',
};

const EMBEDDING_DEFAULTS = {
  ollama: 'nomic-embed-text',
  openai: 'text-embedding-3-small',
  gemini: 'text-embedding-004',
};

export function isEnabled() {
  return !!(process.env.LLM_PROVIDER && process.env.LLM_PROVIDER !== 'none');
}

export function isEmbeddingEnabled() {
  const provider = process.env.LLM_PROVIDER;
  return !!(provider && provider !== 'none' && provider !== 'claude' && EMBEDDING_DEFAULTS[provider]);
}

export function getEmbeddingModel() {
  const provider = process.env.LLM_PROVIDER || 'ollama';
  return process.env.EMBEDDING_MODEL || EMBEDDING_DEFAULTS[provider] || 'nomic-embed-text';
}

export function getProviderInfo() {
  return {
    provider:       process.env.LLM_PROVIDER || 'none',
    model:          process.env.LLM_MODEL || DEFAULTS[process.env.LLM_PROVIDER] || '—',
    enabled:        isEnabled(),
    hasKey:         !!(process.env.LLM_API_KEY),
    embeddingModel: isEmbeddingEnabled() ? getEmbeddingModel() : null,
  };
}

/**
 * Generate a text embedding vector.
 * @param {string} text
 * @returns {Promise<number[]>} float array
 */
export async function getEmbedding(text) {
  if (!isEmbeddingEnabled()) throw new Error('Embeddings no disponibles con el proveedor actual.');

  const provider = process.env.LLM_PROVIDER;
  const model    = getEmbeddingModel();
  const apiKey   = process.env.LLM_API_KEY;

  switch (provider) {
    case 'ollama': return _ollamaEmbed(text, model);
    case 'openai': return _openaiEmbed(text, model, apiKey);
    case 'gemini': return _geminiEmbed(text, model, apiKey);
    default: throw new Error(`Embeddings no soportados para provider: ${provider}`);
  }
}

async function _ollamaEmbed(text, model) {
  const base = process.env.LLM_BASE_URL || 'http://localhost:11434';
  const res = await fetch(`${base}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) throw new Error(`Ollama embed error ${res.status}`);
  const data = await res.json();
  return data.embeddings?.[0] ?? data.embedding ?? [];
}

async function _openaiEmbed(text, model, apiKey) {
  if (!apiKey) throw new Error('LLM_API_KEY requerido para OpenAI embeddings.');
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) throw new Error(`OpenAI embed error ${res.status}`);
  const data = await res.json();
  return data.data?.[0]?.embedding ?? [];
}

async function _geminiEmbed(text, model, apiKey) {
  if (!apiKey) throw new Error('LLM_API_KEY requerido para Gemini embeddings.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { parts: [{ text }] } }),
  });
  if (!res.ok) throw new Error(`Gemini embed error ${res.status}`);
  const data = await res.json();
  return data.embedding?.values ?? [];
}

/**
 * Send a prompt to the configured LLM.
 * @param {string} system  - System/context prompt
 * @param {string} user    - User message
 * @param {object} opts    - { maxTokens, temperature }
 * @returns {Promise<string>} - Text response
 */
export async function complete(system, user, opts = {}) {
  if (!isEnabled()) throw new Error('LLM no configurado. Agrega LLM_PROVIDER y LLM_API_KEY en .env');

  const provider = process.env.LLM_PROVIDER;
  const apiKey   = process.env.LLM_API_KEY;
  const model    = process.env.LLM_MODEL || DEFAULTS[provider];
  const maxTok   = opts.maxTokens || 1024;
  const temp     = opts.temperature ?? 0.3;

  switch (provider) {
    case 'claude':  return _claude(system, user, apiKey, model, maxTok, temp);
    case 'openai':  return _openai(system, user, apiKey, model, maxTok, temp);
    case 'gemini':  return _gemini(system, user, apiKey, model, maxTok, temp);
    case 'ollama':  return _ollama(system, user, model, maxTok, temp);
    default: throw new Error(`LLM_PROVIDER desconocido: "${provider}". Opciones: claude, openai, gemini, ollama`);
  }
}

async function _claude(system, user, apiKey, model, maxTokens, temperature) {
  if (!apiKey) throw new Error('LLM_API_KEY requerido para Claude.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model, max_tokens: maxTokens, temperature,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Claude error ${res.status}: ${err.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

async function _openai(system, user, apiKey, model, maxTokens, temperature) {
  if (!apiKey) throw new Error('LLM_API_KEY requerido para OpenAI.');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model, max_tokens: maxTokens, temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenAI error ${res.status}: ${err.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function _gemini(system, user, apiKey, model, maxTokens, temperature) {
  if (!apiKey) throw new Error('LLM_API_KEY requerido para Gemini.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini error ${res.status}: ${err.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function _ollama(system, user, model, maxTokens, temperature) {
  const base = process.env.LLM_BASE_URL || 'http://localhost:11434';
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, stream: false,
      options: { num_predict: maxTokens, temperature },
      messages: [
        { role: 'system',    content: system },
        { role: 'user',      content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}`);
  const data = await res.json();
  return data.message?.content || '';
}

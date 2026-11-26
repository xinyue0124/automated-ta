// Load test: concurrent students asking questions through the real HTTP API.
//
//   DATABASE_URL=... npm run loadtest -- [--concurrency 1,5,10,20] [--requests 40]
//
// Starts the app in this process, signs up one student, ingests the eval corpus as their notes,
// then for each concurrency level sends --requests chat messages (each in a fresh session, so
// every prompt has the same shape) with that many in flight at once. Reports throughput,
// end-to-end p50/p95, the app's own time per stage, and tokens and cost per answer.
// Without OPENAI_API_KEY the app gives its demo reply, which measures everything except the model.
import { readFile, readdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';

process.env.EMBEDDING_PROVIDER ||= 'local';
process.env.JWT_SECRET ||= 'loadtest-secret';
process.env.LOG_CHAT_STATS = '0';

const { default: pool } = await import('../src/config/database.js');
const { createApp } = await import('../src/app.js');
const { processDocument } = await import('../src/services/documentProcessor.js');
const { onChatStats } = await import('../src/services/telemetry.js');

// USD per 1M tokens, peak rates (off-peak is half), from api-docs.deepseek.com/quick_start/pricing
// on 2026-11-25. Applied only when the API reports a model of that family.
const PRICES = {
  'deepseek-v4-flash': { cacheHit: 0.006, cacheMiss: 0.3, output: 1.2 },
  'deepseek-flash': { cacheHit: 0.006, cacheMiss: 0.3, output: 1.2 },
  'deepseek-v4-pro': { cacheHit: 0.044, cacheMiss: 1.32, output: 3.96 }
};

const { values: opts } = parseArgs({
  options: {
    concurrency: { type: 'string', default: '1,5,10,20' },
    requests: { type: 'string', default: '40' }
  }
});
const levels = opts.concurrency.split(',').map(Number);
const perLevel = Number(opts.requests);

await pool.query(await readFile(new URL('../db/init.sql', import.meta.url), 'utf8'));
const server = createApp({ authRateLimitMax: 1e6 }).listen(0);
const base = `http://127.0.0.1:${server.address().port}/api`;

async function api(path, token, body) {
  const res = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

const { token, user } = await api('/auth/signup', null, {
  email: `loadtest-${Date.now()}@example.com`, password: 'secret123', fullName: 'Load test'
});

try {
  const corpusDir = new URL('../eval/corpus/', import.meta.url);
  for (const name of (await readdir(corpusDir)).sort()) {
    const { rows: [doc] } = await pool.query(
      'INSERT INTO documents (user_id, filename, original_name, file_type) VALUES ($1, $2, $2, $3) RETURNING id',
      [user.id, name, 'text/markdown']
    );
    await processDocument(doc.id, new URL(name, corpusDir).pathname, user.id);
  }
  const { inScope } = JSON.parse(await readFile(new URL('../eval/questions.json', import.meta.url), 'utf8'));
  // Warm up the embedding model and connections before timing anything
  await api(`/chat/sessions/${(await api('/chat/sessions', token, {})).session.id}/messages`, token, { content: inScope[0].q });

  const stats = [];
  onChatStats((s) => stats.push(s));
  const pct = (xs, p) => xs.sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil((p / 100) * xs.length) - 1)];
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const fmt = (x) => (Number.isNaN(x) ? '-' : Math.round(x));
  const rows = [];

  for (const c of levels) {
    const sessions = [];
    for (let i = 0; i < perLevel; i++) sessions.push((await api('/chat/sessions', token, {})).session.id);
    stats.length = 0;
    const latencies = [];
    let errors = 0;
    let next = 0;
    const t0 = performance.now();
    await Promise.all(Array.from({ length: c }, async () => {
      while (next < perLevel) {
        const i = next++;
        const start = performance.now();
        try {
          await api(`/chat/sessions/${sessions[i]}/messages`, token, { content: inScope[i % inScope.length].q });
          latencies.push(performance.now() - start);
        } catch {
          errors++;
        }
      }
    }));
    const seconds = (performance.now() - t0) / 1000;
    const field = (k) => stats.map((s) => s[k]).filter((v) => v !== undefined);
    const price = PRICES[stats[0]?.model?.replace(/-\d{4,}$/, '')];
    const cost = price && mean(stats.map((s) => {
      const hit = s.cachedPromptTokens ?? 0;
      return ((s.promptTokens - hit) * price.cacheMiss + hit * price.cacheHit + s.completionTokens * price.output) / 1e6;
    }));
    rows.push({
      concurrency: c,
      requests: perLevel,
      errors,
      'req/s': (latencies.length / seconds).toFixed(1),
      'p50 ms': Math.round(pct(latencies, 50)),
      'p95 ms': Math.round(pct(latencies, 95)),
      'embed ms': Math.round(mean(field('embedMs'))),
      'search ms': Math.round(mean(field('searchMs'))),
      'llm ms': fmt(mean(field('llmMs'))),
      'prompt tok': fmt(mean(field('promptTokens'))),
      'output tok': fmt(mean(field('completionTokens'))),
      'USD/answer': cost ? cost.toFixed(5) : '-'
    });
  }

  console.log(`\nmodel: ${stats[0]?.model}, ${perLevel} requests per level, each in a new session`);
  console.table(rows);
} finally {
  server.close();
  await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
  await pool.end();
}

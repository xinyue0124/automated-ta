// Retrieval eval: ingest the course corpus through the real pipeline (extract, chunk, embed,
// pgvector), ask the question set, and score where the passage that answers each question ranks.
//
//   DATABASE_URL=... npm run eval -- [--chunk-size 1000] [--overlap 200] [--threshold 0.22]
//                                   [--force-index] [--tenants N] [--json out.json]
//
// Exits 1 if hit@3 falls below MIN_HIT_AT_3, so CI catches retrieval regressions.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

process.env.EMBEDDING_PROVIDER ||= 'local';

const { default: pool } = await import('../src/config/database.js');
const { processDocument, searchRelevantChunks } = await import('../src/services/documentProcessor.js');

const MIN_HIT_AT_3 = 0.8;
const K = 5;

const { values: opts } = parseArgs({
  options: {
    'chunk-size': { type: 'string', default: '1000' },
    overlap: { type: 'string', default: '200' },
    threshold: { type: 'string', default: '0.22' },
    'force-index': { type: 'boolean', default: false },
    tenants: { type: 'string', default: '0' },
    json: { type: 'string' }
  }
});
const chunkSize = Number(opts['chunk-size']);
const overlap = Number(opts.overlap);
const threshold = Number(opts.threshold);

// On a small table Postgres scans it directly. With many rows it uses indexes instead.
// --force-index disables sequential scans so the eval measures that larger-table plan.
if (opts['force-index']) pool.on('connect', (client) => client.query('SET enable_seqscan = off'));

const corpusDir = new URL('./corpus/', import.meta.url);
const { inScope, outOfScope } = JSON.parse(await readFile(new URL('./questions.json', import.meta.url), 'utf8'));

await pool.query(await readFile(new URL('../db/init.sql', import.meta.url), 'utf8'));
const { rows: [user] } = await pool.query(
  "INSERT INTO users (email, password_hash, full_name) VALUES ($1, 'x', 'Eval') RETURNING id",
  [`eval-${Date.now()}@example.com`]
);

const extraUsers = [];
try {
  // Ingest
  for (const name of (await readdir(corpusDir)).sort()) {
    const { rows: [doc] } = await pool.query(
      'INSERT INTO documents (user_id, filename, original_name, file_type) VALUES ($1, $2, $2, $3) RETURNING id',
      [user.id, name, 'text/markdown']
    );
    await processDocument(doc.id, new URL(name, corpusDir).pathname, user.id, { chunkSize, overlap });
    const { rows: [state] } = await pool.query('SELECT processed FROM documents WHERE id = $1', [doc.id]);
    if (!state.processed) throw new Error(`failed to ingest ${name}`);
  }
  // --tenants N: other users who uploaded the same kind of material, so the vector search has
  // to skip near-identical chunks that belong to someone else (copies keep the test fast).
  const tenants = Number(opts.tenants);
  for (let i = 0; i < tenants; i++) {
    const { rows: [other] } = await pool.query(
      "INSERT INTO users (email, password_hash, full_name) VALUES ($1, 'x', 'Eval tenant') RETURNING id",
      [`eval-tenant-${Date.now()}-${i}@example.com`]
    );
    extraUsers.push(other.id);
    await pool.query(
      `INSERT INTO document_chunks (document_id, user_id, content, chunk_index, embedding)
       SELECT document_id, $1, content, chunk_index, embedding FROM document_chunks WHERE user_id = $2`,
      [other.id, user.id]
    );
  }

  const { rows: [{ count: chunkCount }] } = await pool.query(
    'SELECT count(*)::int AS count FROM document_chunks WHERE user_id = $1', [user.id]
  );

  // In-scope questions: rank of the first retrieved chunk that contains the evidence passage
  const results = [];
  const latencies = [];
  for (const item of inScope) {
    const t0 = performance.now();
    const hits = await searchRelevantChunks(item.q, user.id, K);
    latencies.push(performance.now() - t0);
    const rank = hits.findIndex((h) => h.content.includes(item.evidence)) + 1; // 0 = not in top K
    results.push({ ...item, rank, retrieved: hits.length, top1: Number(hits[0]?.similarity ?? 0) });
  }

  // Out-of-scope questions: the best similarity should be low enough to say "not in your materials"
  const offTopic = [];
  for (const q of outOfScope) {
    const hits = await searchRelevantChunks(q, user.id, 1);
    offTopic.push({ q, top1: Number(hits[0]?.similarity ?? 0) });
  }

  const n = results.length;
  const hitAt = (k) => results.filter((r) => r.rank && r.rank <= k).length / n;
  const mrr = results.reduce((s, r) => s + (r.rank ? 1 / r.rank : 0), 0) / n;
  const refused = offTopic.filter((o) => o.top1 < threshold).length / offTopic.length;
  const falseRefusals = results.filter((r) => r.top1 < threshold).length / n;
  const short = results.filter((r) => r.retrieved < K).length;
  const medianMs = latencies.sort((a, b) => a - b)[Math.floor(latencies.length / 2)];

  const summary = {
    config: { chunkSize, overlap, k: K, threshold, chunks: chunkCount, otherTenants: tenants, forceIndex: opts['force-index'] },
    retrieval: { 'hit@1': hitAt(1), 'hit@3': hitAt(3), [`hit@${K}`]: hitAt(K), mrr, questionsWithFewerThanKResults: short, medianSearchMs: Math.round(medianMs) },
    outOfScope: { refusedAtThreshold: refused, inScopeWronglyRefused: falseRefusals }
  };

  const pct = (x) => `${(x * 100).toFixed(0)}%`;
  console.log(`\nchunk ${chunkSize}/${overlap}, ${chunkCount} chunks, ${n} questions, k=${K}${tenants ? `, ${tenants} other tenants` : ''}${opts['force-index'] ? ', vector index forced' : ''}`);
  console.log(`hit@1 ${pct(hitAt(1))}  hit@3 ${pct(hitAt(3))}  hit@${K} ${pct(hitAt(K))}  MRR ${mrr.toFixed(3)}  median search ${medianMs.toFixed(0)} ms`);
  if (short) console.log(`warning: ${short} searches returned fewer than ${K} chunks`);
  console.log(`threshold ${threshold}: refuses ${pct(refused)} of off-topic questions, wrongly refuses ${pct(falseRefusals)} of course questions`);
  const misses = results.filter((r) => !r.rank || r.rank > 3);
  if (misses.length) {
    console.log('\nnot in top 3:');
    for (const r of misses) console.log(`  [${r.rank || '-'}] ${r.q}`);
  }
  const sims = (xs) => xs.map((x) => x.top1).sort((a, b) => a - b);
  const range = (xs) => `${sims(xs)[0].toFixed(2)}–${sims(xs).at(-1).toFixed(2)}`;
  console.log(`\ntop-1 similarity: course questions ${range(results)}, off-topic ${range(offTopic)}`);

  if (opts.json) await writeFile(opts.json, JSON.stringify({ summary, results, offTopic }, null, 2));
  if (hitAt(3) < MIN_HIT_AT_3) {
    console.error(`\nFAIL: hit@3 ${pct(hitAt(3))} is below ${pct(MIN_HIT_AT_3)}`);
    process.exitCode = 1;
  }
} finally {
  await pool.query('DELETE FROM users WHERE id = ANY($1)', [[user.id, ...extraUsers]]);
  await pool.end();
}

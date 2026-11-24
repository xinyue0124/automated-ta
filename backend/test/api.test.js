// API tests against a real Postgres with pgvector (DATABASE_URL).
// They cover what breaks in a multi-tenant API, not the happy path:
// bad tokens, one user reading another's data, invalid input, and brute-force sign-in.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { buildPdf, buildDocx, buildPptx } from './fixtures.js';

process.env.JWT_SECRET ||= 'test-secret';

const { default: pool } = await import('../src/config/database.js');
const { createApp } = await import('../src/app.js');

const app = createApp({ authRateLimitMax: 1000 });
const run = Date.now();

async function signUp(name) {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ email: `${name}-${run}@example.com`, password: 'secret123', fullName: name });
  assert.equal(res.status, 201);
  return res.body.token;
}

before(async () => {
  await pool.query(await readFile(new URL('../db/init.sql', import.meta.url), 'utf8'));
});

after(() => pool.end());

test('protected routes reject a missing token', async () => {
  const res = await request(app).get('/api/chat/sessions');
  assert.equal(res.status, 401);
});

test('protected routes reject a forged token', async () => {
  const forged = jwt.sign({ userId: 1 }, 'not-the-server-secret');
  const res = await request(app).get('/api/chat/sessions').set('Authorization', `Bearer ${forged}`);
  assert.equal(res.status, 403);
});

test('protected routes reject an expired token', async () => {
  const expired = jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { expiresIn: -10 });
  const res = await request(app).get('/api/chat/sessions').set('Authorization', `Bearer ${expired}`);
  assert.equal(res.status, 403);
});

test("a user cannot read or write another user's chat session", async () => {
  const alice = await signUp('alice');
  const bob = await signUp('bob');

  const created = await request(app)
    .post('/api/chat/sessions')
    .set('Authorization', `Bearer ${alice}`)
    .send({ title: 'Alice private' });
  assert.equal(created.status, 201);
  const sessionId = created.body.session.id;

  const read = await request(app)
    .get(`/api/chat/sessions/${sessionId}/messages`)
    .set('Authorization', `Bearer ${bob}`);
  assert.equal(read.status, 404);

  const write = await request(app)
    .post(`/api/chat/sessions/${sessionId}/messages`)
    .set('Authorization', `Bearer ${bob}`)
    .send({ content: 'hello' });
  assert.equal(write.status, 404);

  const list = await request(app).get('/api/chat/sessions').set('Authorization', `Bearer ${bob}`);
  assert.equal(list.status, 200);
  assert.ok(!list.body.sessions.some((s) => s.id === sessionId));

  await request(app).delete(`/api/chat/sessions/${sessionId}`).set('Authorization', `Bearer ${bob}`);
  const stillThere = await request(app)
    .get(`/api/chat/sessions/${sessionId}/messages`)
    .set('Authorization', `Bearer ${alice}`);
  assert.equal(stillThere.status, 200);
});

test('chat rejects an empty or whitespace-only message', async () => {
  const token = await signUp('carol');
  const created = await request(app)
    .post('/api/chat/sessions')
    .set('Authorization', `Bearer ${token}`)
    .send({});
  for (const content of ['', '   ', undefined]) {
    const res = await request(app)
      .post(`/api/chat/sessions/${created.body.session.id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content });
    assert.equal(res.status, 400);
  }
});

test('sign-up rejects an invalid email and a short password', async () => {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ email: 'not-an-email', password: '123', fullName: 'Dan' });
  assert.equal(res.status, 400);
  const fields = res.body.errors.map((e) => e.path).sort();
  assert.deepEqual(fields, ['email', 'password']);
});

async function waitForChunks(documentId) {
  for (let i = 0; i < 50; i++) {
    const { rows } = await pool.query(
      'SELECT d.processed, c.content FROM documents d LEFT JOIN document_chunks c ON c.document_id = d.id WHERE d.id = $1',
      [documentId]
    );
    if (rows[0]?.processed) return rows.map((r) => r.content).join(' ');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`document ${documentId} was not processed`);
}

test('uploaded PDF, DOCX and PPTX files are parsed into chunks', async () => {
  const token = await signUp('erin');
  const files = [
    ['notes.pdf', buildPdf('Inverted pyramid puts the key facts first')],
    ['notes.docx', await buildDocx(['Attribute every claim to a named source'])],
    ['lecture.pptx', await buildPptx({ 1: [['Nut graf'], ['explains why the story matters']] })]
  ];
  const expected = ['Inverted pyramid', 'Attribute every claim', 'Nut graf'];

  for (const [i, [name, data]] of files.entries()) {
    const upload = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', data, name);
    assert.equal(upload.status, 201, `${name}: ${JSON.stringify(upload.body)}`);
    const id = upload.body.document.id;
    assert.match(await waitForChunks(id), new RegExp(expected[i]));
    await request(app).delete(`/api/files/${id}`).set('Authorization', `Bearer ${token}`);
  }
});

test('sign-in is rate limited per IP', async () => {
  const limited = createApp({ authRateLimitMax: 3 });
  const attempt = () => request(limited)
    .post('/api/auth/signin')
    .send({ email: `nobody-${run}@example.com`, password: 'wrong' });
  for (let i = 0; i < 3; i++) assert.equal((await attempt()).status, 401);
  assert.equal((await attempt()).status, 429);
});

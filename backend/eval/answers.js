// Answer eval: ask the app's model each question with the app's real prompt and retrieved notes,
// then have a judge model score the answer against a fixed rubric. Needs OPENAI_API_KEY (any
// OpenAI-compatible API via OPENAI_BASE_URL and AI_MODEL; JUDGE_MODEL defaults to AI_MODEL).
import OpenAI from 'openai';
import { buildMessages, completeChat, AI_MODEL } from '../src/services/aiService.js';
import { searchRelevantChunks } from '../src/services/documentProcessor.js';

export const JUDGE_MODEL = process.env.JUDGE_MODEL || AI_MODEL;
const TOP_K = 3; // what the app sends the model
const CONCURRENCY = 4;

const RUBRIC = `You grade answers from a teaching assistant that must answer from a student's course notes.
You get the student's question, the notes the assistant was given, a reference answer from the course
materials (or NOT IN MATERIALS if the materials do not answer it), and the assistant's answer.

Return JSON with these fields:
- "grounded": 0, 1 or 2.
  2 = every factual claim in the answer is stated in or directly follows from the notes given.
  1 = the main claim is supported by the notes, but the answer adds some detail the notes do not contain.
  0 = the main claim is not in the notes (general knowledge, guesswork) or contradicts them.
  A refusal that makes no factual claims is 2.
- "correct": true if the answer agrees with the reference answer and does not contradict it.
  For NOT IN MATERIALS, true only if the answer says the notes do not cover the question.
- "refused": true if the answer says the notes or course materials do not cover the question,
  or declines to answer. Pointing the student elsewhere while still answering the question is false.
- "reason": one short sentence.`;

const judge = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function grade({ q, notes, reference, answer }) {
  const prompt = `${RUBRIC}

Question: ${q}

Notes given to the assistant:
${notes.map((n, i) => `[Note ${i + 1}]\n${n}`).join('\n\n')}

Reference answer: ${reference}

Assistant's answer:
${answer}`;
  const res = await judge.chat.completions.create({
    model: JUDGE_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    response_format: { type: 'json_object' }
  });
  const v = JSON.parse(res.choices[0].message.content);
  if (![0, 1, 2].includes(v.grounded) || typeof v.correct !== 'boolean' || typeof v.refused !== 'boolean') {
    throw new Error(`bad judge output: ${res.choices[0].message.content}`);
  }
  return v;
}

async function answerAndGrade(userId, q, reference, mode) {
  const chunks = await searchRelevantChunks(q, userId, TOP_K, { mode });
  const { content: answer } = await completeChat(buildMessages(q, chunks));
  const verdict = await grade({ q, notes: chunks.map((c) => c.content), reference, answer });
  return { q, reference, answer, ...verdict };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

export async function evalAnswers(userId, inScope, outOfScope, mode = 'hybrid') {
  // The reference for a course question is the passage that answers it, quoted from the corpus.
  const course = await mapLimit(inScope, CONCURRENCY, (item) => answerAndGrade(userId, item.q, item.evidence, mode));
  const offTopic = await mapLimit(outOfScope, CONCURRENCY, (q) => answerAndGrade(userId, q, 'NOT IN MATERIALS', mode));

  const share = (xs, f) => xs.filter(f).length / xs.length;
  const summary = {
    retrieval: mode,
    model: AI_MODEL,
    judge: JUDGE_MODEL,
    groundedness: course.reduce((s, r) => s + r.grounded, 0) / (2 * course.length), // 0..1
    fullyGrounded: share(course, (r) => r.grounded === 2),
    correct: share(course, (r) => r.correct),
    inScopeRefused: share(course, (r) => r.refused),
    offTopicRefused: share(offTopic, (r) => r.refused),
    offTopicGrounded: share(offTopic, (r) => r.grounded === 2)
  };
  return { summary, course, offTopic };
}

export function printAnswers({ summary, course, offTopic }) {
  const pct = (x) => `${(x * 100).toFixed(0)}%`;
  console.log(`\nanswers: ${summary.retrieval} retrieval, model ${summary.model}, judge ${summary.judge}, top ${TOP_K} notes`);
  console.log(`course questions: groundedness ${pct(summary.groundedness)} (fully grounded ${pct(summary.fullyGrounded)}), correct ${pct(summary.correct)}, wrongly refused ${pct(summary.inScopeRefused)}`);
  console.log(`off-topic questions: refused ${pct(summary.offTopicRefused)}`);
  const flagged = [...course.filter((r) => r.grounded < 2 || !r.correct || r.refused), ...offTopic.filter((r) => !r.refused)];
  if (flagged.length) {
    console.log('\nflagged:');
    for (const r of flagged) console.log(`  [g${r.grounded}${r.correct ? '' : ' wrong'}${r.refused ? ' refused' : ''}] ${r.q}: ${r.reason}`);
  }
}

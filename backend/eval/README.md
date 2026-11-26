# Eval

Measures whether the assistant finds the right course material for a student's question, and, with a model key, whether its answers stick to that material and decline questions the material does not cover. It runs the real pipeline: extract text, chunk it, embed it with the local model (all-MiniLM-L6-v2, no API key), store it in Postgres with pgvector, and search it with `searchRelevantChunks`.

- `corpus/`: four documents for a fictional intro reporting course, written for this eval.
- `questions.json`: 30 student-style questions, each with the passage that answers it, plus 10 questions the materials cannot answer.

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/automated_ta npm run eval
```

With `OPENAI_API_KEY` set, the same command also scores answers (see below); without a key that part prints "skipped". Any OpenAI-compatible API works:

```bash
OPENAI_API_KEY=... OPENAI_BASE_URL=https://api.deepseek.com AI_MODEL=deepseek-chat npm run eval
```

Options: `--retrieval hybrid|vector` (default hybrid; vector is the old vector-only search), `--retrieval-only` (no model calls), `--chunk-size`, `--overlap`, `--threshold`, `--force-index` (disable sequential scans, as Postgres does on large tables), `--tenants N` (add N other users with similar material), `--json out.json`.

The first run downloads the embedding model (about 90 MB) into `backend/models/`. CI runs the eval on every push and fails if hit@3 drops below 80%.

## Metrics

- **hit@k**: share of questions where a chunk containing the answer passage is in the top k results. The app sends the top 3 to the model, so hit@3 is the number that matters.
- **MRR**: mean of 1 / rank of the first correct chunk; rewards ranking the answer first.
- **Off-topic refusal**: share of off-topic questions whose best match falls below the similarity threshold, and share of course questions wrongly below it.

## Results (Nov 2026)

Chunk size and overlap, in characters (vector-only search):

| Chunking | Chunks | hit@1 | hit@3 | hit@5 | MRR |
|---|---|---|---|---|---|
| 500 / 100 | 36 | 67% | 90% | 97% | 0.787 |
| 700 / 150 | 27 | 60% | 90% | 100% | 0.766 |
| **1000 / 200 (current)** | 19 | 73% | 87% | 100% | **0.826** |
| 1500 / 300 | 14 | 53% | 87% | 93% | 0.704 |
| 1000 / 0 | 15 | 60% | 87% | 90% | 0.731 |

The current setting ranks best. Overlap matters: without it, MRR drops from 0.83 to 0.73. Packing whole paragraphs and sentences instead of fixed character windows did not help (MRR 0.80 at 1000/200), so the simpler chunker stays.

Findings:

1. **The IVFFlat index broke retrieval at scale.** The schema built an IVFFlat index (100 lists) on the empty table, and the query filters by user after the approximate scan. On a small table Postgres ignores the index, so normal tests passed. With `--force-index`, the plan Postgres uses once a table is large, hit@3 fell from 87% to 3% and 29 of 30 searches returned fewer than 5 chunks. Search is now exact over the user's own chunks, found through a `user_id` index: full scores with 50 other tenants in the table, median search 3 ms including the query embedding.
2. **A similarity threshold alone cannot separate off-topic questions.** Course questions score as low as 0.14, and off-topic questions as high as 0.21. A threshold of 0.22 refuses all 10 off-topic questions but also 1 of 30 course questions, with a thin margin. The threshold is better used as a signal to the model than as a hard refusal.
3. **Remaining misses were vocabulary gaps**, not chunk boundaries: "ChatGPT" vs "AI tools", "the last story" vs "the final feature". Hybrid search (below) fixed three of the four.

### Hybrid search

`searchRelevantChunks` now combines two rankings of the user's chunks: vector similarity, and Postgres full-text search (English stemming, the question's words OR-ed, ranked by `ts_rank`, over a stored `tsvector` column with a GIN index). Each side ranks its top 20, and reciprocal rank fusion (sum of 1 / (60 + rank)) merges them, so the two score scales never need to be compared.

| Retrieval | hit@1 | hit@3 | hit@5 | MRR | Median search |
|---|---|---|---|---|---|
| Vector only | 73% | 87% | 100% | 0.826 | 3–4 ms |
| **Hybrid (current)** | 70% | **97%** | 97% | 0.828 | 3–4 ms |

Exact words that the embedding missed, "extension" and "roommate(s)", now reach the top 3, and so does "What if I spell someone's name wrong?" (its passage says "misspelled name"). The cost is small but real: one question drops from 1st place, and "Am I allowed to use ChatGPT?" falls out of the top 5 (it was 5th), because no word in it appears in its passage ("AI tools"). With 50 other tenants and the vector plan forced, scores are the same.

## Answer quality

`answers.js` sends each of the 40 questions through the app's own prompt (`buildMessages` in `aiService.js`, top 3 retrieved notes, temperature 0.7), then a judge model (`JUDGE_MODEL`, default the same model, temperature 0) grades the answer against the notes it was given and the reference passage from `questions.json`:

- **groundedness** (0, 1, 2): 2 = every claim is in the notes; 1 = main claim supported, extra unsupported detail; 0 = main claim not in the notes or contradicts them. Reported as the mean over course questions (0–100%) and the share scored 2.
- **correct**: the answer agrees with the reference passage.
- **refused**: the answer says the notes do not cover the question. Wanted for the 10 off-topic questions, unwanted for the 30 course questions.

CI runs this part only if the repository has an `OPENAI_API_KEY` secret (plus optional `OPENAI_BASE_URL` and `AI_MODEL` variables); otherwise it is skipped and only retrieval is scored. Limits: one sample per question at temperature 0.7, and a model judging its own answers can be lenient; read the flagged answers the run prints.

### Results (Nov 2026, DeepSeek `deepseek-chat` as model and judge, 3 runs per setup)

The first prompt asked the model to "use the notes as context". The notes-only prompt says to answer only from the notes, name the note used, and say the notes don't cover a question instead of answering from general knowledge. Same questions and judge throughout.

| Metric (range over 3 runs) | Old prompt, vector | Notes-only, vector | **Notes-only, hybrid (current)** |
|---|---|---|---|
| Groundedness, course questions (mean of 0–2, as %) | 83–85% | 98–100% | 98–100% |
| Course answers fully grounded (score 2) | 70–73% | 97–100% | 97–100% |
| Off-topic: says the notes don't cover it | 60–80% | 100% | 100% |
| Off-topic: no outside knowledge at all | 30–60% | 100% | 100% |
| Course questions answered and correct | 26–27 of 30 | 25 of 30 | **26–28 of 30** |
| Course answers confidently wrong | 2–3 | 1–2 | 0–1 |
| Course questions refused | 1–2 | 3–4 | 2–3 |

Findings:

1. **Every wrong answer traced to retrieval.** With vector search, each incorrect course answer was a question whose answer passage ranked 4th or 5th, outside the 3 notes the model sees. The old prompt filled the gap from general knowledge ("Can I interview my roommate?" got "yes"; the syllabus forbids it). The notes-only prompt refused instead. Hybrid search put those passages in the top 3, and the refusals became correct answers.
2. **The notes-only prompt is sometimes too literal.** With hybrid search, "What is a kicker?" was refused in all 3 runs although its passage ranked 1st: the model quoted the definition and then said the notes "do not define the term". "Can I fix the grammar inside a direct quote?" was refused the same way once. It also once answered "Yes, AP style does not use the Oxford comma". These are prompt and model errors, not retrieval errors.
3. **"ChatGPT" vs "AI tools" is still a miss.** Neither search finds it; query rewriting or a reranker is the next thing to try.
4. **The judge is lenient.** It marks an honest "not covered" as correct when it does not contradict the reference, and "your notes don't cover this, but here is the answer" as a refusal. The "answered and correct" and "no outside knowledge" rows correct for this; read the flagged answers each run prints.

# Retrieval eval

Measures whether the assistant finds the right course material for a student's question. It runs the real pipeline: extract text, chunk it, embed it with the local model (all-MiniLM-L6-v2, no API key), store it in Postgres with pgvector, and search it with `searchRelevantChunks`.

- `corpus/`: four documents for a fictional intro reporting course, written for this eval.
- `questions.json`: 30 student-style questions, each with the passage that answers it, plus 10 questions the materials cannot answer.

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/automated_ta npm run eval
```

Options: `--chunk-size`, `--overlap`, `--threshold`, `--force-index` (disable sequential scans, as Postgres does on large tables), `--tenants N` (add N other users with similar material), `--json out.json`.

The first run downloads the embedding model (about 90 MB) into `backend/models/`. CI runs the eval on every push and fails if hit@3 drops below 80%.

## Metrics

- **hit@k**: share of questions where a chunk containing the answer passage is in the top k results. The app sends the top 3 to the model, so hit@3 is the number that matters.
- **MRR**: mean of 1 / rank of the first correct chunk; rewards ranking the answer first.
- **Off-topic refusal**: share of off-topic questions whose best match falls below the similarity threshold, and share of course questions wrongly below it.

## Results (Nov 2026)

Chunk size and overlap, in characters:

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
3. **Remaining misses are vocabulary gaps**, not chunk boundaries: "ChatGPT" vs "AI tools", "the last story" vs "the final feature".

Not yet measured: answer quality (groundedness, refusals by the model). That needs a model call per question and a scoring rubric.

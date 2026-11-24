import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const DIM = 1536; // matches vector(1536) in db/init.sql

// openai: text-embedding-ada-002 (needs OPENAI_API_KEY).
// local:  all-MiniLM-L6-v2 on this machine, no key. Its 384-dim vector is zero-padded
//         to 1536, which leaves cosine similarity unchanged.
// mock:   random vectors, only for tests that do not care about retrieval quality.
// One database must use one provider: vectors from different models are not comparable.
const provider = process.env.EMBEDDING_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'local');

const openai = provider === 'openai' ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

let localModel;
async function localEmbedding(text) {
  if (!localModel) {
    const { pipeline, env } = await import('@huggingface/transformers');
    // Look in backend/models/ first; on a miss, download from the Hugging Face Hub into the same folder.
    const modelDir = new URL('../../models/', import.meta.url).pathname;
    env.localModelPath = modelDir;
    env.cacheDir = modelDir;
    localModel = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'fp32' });
  }
  const out = await (await localModel)(text, { pooling: 'mean', normalize: true });
  const vec = Array.from(out.data);
  return vec.concat(Array(DIM - vec.length).fill(0));
}

export async function createEmbedding(text) {
  if (provider === 'local') return localEmbedding(text);
  if (provider === 'mock') return Array.from({ length: DIM }, () => Math.random() * 2 - 1);

  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text.slice(0, 8000) // stay within the model's token limit
  });
  return response.data[0].embedding;
}

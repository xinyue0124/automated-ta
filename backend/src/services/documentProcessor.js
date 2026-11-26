import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';
import pool from '../config/database.js';
import { createEmbedding } from './embeddingService.js';

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXml(text) {
  return text.replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => XML_ENTITIES[name]);
}

// A .pptx file is a zip; each slide is ppt/slides/slideN.xml with text in <a:t> runs inside <a:p> paragraphs.
async function extractPptxText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

  const slideTexts = [];
  for (const name of slides) {
    const xml = await zip.file(name).async('string');
    const paragraphs = (xml.match(/<a:p(?:\s[^>]*)?>[\s\S]*?<\/a:p>/g) || [])
      .map((p) => [...p.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)]
        .map((m) => decodeXml(m[1]))
        .join(''))
      .filter((line) => line.trim());
    if (paragraphs.length) slideTexts.push(paragraphs.join('\n'));
  }
  return slideTexts.join('\n\n');
}

// Extract text from different file types
export async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const parser = new PDFParse({ data: await fs.readFile(filePath) });
    try {
      const { text } = await parser.getText({ pageJoiner: '' });
      return text;
    } finally {
      await parser.destroy();
    }
  }
  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }
  if (ext === '.pptx') {
    return extractPptxText(await fs.readFile(filePath));
  }
  if (ext === '.txt' || ext === '.md') {
    return fs.readFile(filePath, 'utf-8');
  }
  throw new Error(`Unsupported file type: ${ext}`);
}

// Split text into chunks
export function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    
    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }
    
    start += chunkSize - overlap;
  }

  return chunks;
}

// Process document: extract text, chunk it, create embeddings
export async function processDocument(documentId, filePath, userId, { chunkSize = 1000, overlap = 200 } = {}) {
  try {
    console.log(`Processing document ${documentId}...`);

    // Extract text from document
    const text = await extractText(filePath);
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text content extracted from document');
    }

    // Split into chunks
    const chunks = chunkText(text, chunkSize, overlap);
    console.log(`Created ${chunks.length} chunks for document ${documentId}`);

    // Create embeddings and store chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Create embedding for chunk
      const embedding = await createEmbedding(chunk);
      
      // Store chunk with embedding
      await pool.query(
        `INSERT INTO document_chunks (document_id, user_id, content, chunk_index, embedding)
         VALUES ($1, $2, $3, $4, $5)`,
        [documentId, userId, chunk, i, JSON.stringify(embedding)]
      );
    }

    // Mark document as processed
    await pool.query(
      'UPDATE documents SET processed = TRUE WHERE id = $1',
      [documentId]
    );

    console.log(`Document ${documentId} processed successfully`);
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);
    // Mark as failed but don't throw
    await pool.query(
      'UPDATE documents SET processed = FALSE WHERE id = $1',
      [documentId]
    );
  }
}

// Search for relevant chunks using vector similarity
// Hybrid search over one user's chunks. Vector search finds paraphrases; keyword search
// (Postgres full-text, English stemming) finds exact terms the embedding misses, such as
// "extension" or "roommate". Each side ranks its top CANDIDATES, and reciprocal rank fusion
// (score = sum of 1 / (60 + rank)) merges the two lists without tuning score scales.
// mode 'vector' is the old vector-only search, kept for the eval's before/after comparison.
const CANDIDATES = 20;
const RRF_K = 60;

// timings, if given, receives embedMs and searchMs.
export async function searchRelevantChunks(query, userId, limit = 5, { mode = 'hybrid', timings } = {}) {
  try {
    const t0 = performance.now();
    const queryEmbedding = JSON.stringify(await createEmbedding(query));
    const t1 = performance.now();
    if (timings) timings.embedMs = t1 - t0;
    const done = (rows) => {
      if (timings) timings.searchMs = performance.now() - t1;
      return rows;
    };

    if (mode === 'vector') {
      const result = await pool.query(
        `SELECT content, 1 - (embedding <=> $1::vector) AS similarity
         FROM document_chunks
         WHERE user_id = $2
         ORDER BY embedding <=> $1::vector
         LIMIT $3`,
        [queryEmbedding, userId, limit]
      );
      return done(result.rows);
    }

    // plainto_tsquery ANDs every word, which almost never matches a whole question;
    // OR the stemmed words instead and let ts_rank prefer chunks that match more of them.
    const result = await pool.query(
      `WITH q AS (
         SELECT replace(plainto_tsquery('english', $4)::text, ' & ', ' | ')::tsquery AS tsq
       ),
       vec AS (
         SELECT id, row_number() OVER (ORDER BY embedding <=> $1::vector, id) AS rank
         FROM document_chunks
         WHERE user_id = $2
         ORDER BY embedding <=> $1::vector, id
         LIMIT $5
       ),
       kw AS (
         SELECT id, row_number() OVER (ORDER BY ts_rank(content_tsv, q.tsq) DESC, id) AS rank
         FROM document_chunks, q
         WHERE user_id = $2 AND content_tsv @@ q.tsq
         ORDER BY ts_rank(content_tsv, q.tsq) DESC, id
         LIMIT $5
       ),
       fused AS (
         SELECT id, sum(1.0 / ($6 + rank)) AS score
         FROM (SELECT * FROM vec UNION ALL SELECT * FROM kw) ranked
         GROUP BY id
       )
       SELECT c.content, 1 - (c.embedding <=> $1::vector) AS similarity
       FROM fused JOIN document_chunks c USING (id)
       ORDER BY fused.score DESC, c.id
       LIMIT $3`,
      [queryEmbedding, userId, limit, query, CANDIDATES, RRF_K]
    );
    return done(result.rows);
  } catch (error) {
    console.error('Error searching chunks:', error);
    return [];
  }
}

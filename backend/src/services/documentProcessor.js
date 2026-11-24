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
export async function searchRelevantChunks(query, userId, limit = 5) {
  try {
    // Create embedding for query
    const queryEmbedding = await createEmbedding(query);

    // Search for similar chunks using cosine similarity
    const result = await pool.query(
      `SELECT content, 
              1 - (embedding <=> $1::vector) as similarity
       FROM document_chunks
       WHERE user_id = $2
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [JSON.stringify(queryEmbedding), userId, limit]
    );

    return result.rows;
  } catch (error) {
    console.error('Error searching chunks:', error);
    return [];
  }
}


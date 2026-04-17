import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import pool from '../config/database.js';
import { createEmbedding } from './embeddingService.js';

// Extract text from different file types
async function extractText(filePath, fileType) {
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.pdf') {
      // For now, return a placeholder for PDF files
      // In production, you would use a proper PDF parsing library
      return 'PDF content extraction not available in demo mode. Please use TXT, DOCX, or MD files for now.';
    } else if (ext === '.docx' || ext === '.doc') {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } else if (ext === '.txt' || ext === '.md') {
      return await fs.readFile(filePath, 'utf-8');
    }
    throw new Error('Unsupported file type');
  } catch (error) {
    console.error('Error extracting text:', error);
    throw error;
  }
}

// Split text into chunks
function chunkText(text, chunkSize = 1000, overlap = 200) {
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
export async function processDocument(documentId, filePath, userId) {
  try {
    console.log(`Processing document ${documentId}...`);

    // Extract text from document
    const text = await extractText(filePath, path.extname(filePath));
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text content extracted from document');
    }

    // Split into chunks
    const chunks = chunkText(text);
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


import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Create embedding for text
export async function createEmbedding(text) {
  if (!openai) {
    console.warn('OpenAI API key not configured, returning mock embedding');
    // Return a mock embedding of correct dimension (1536 for text-embedding-ada-002)
    return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.slice(0, 8000) // Limit to 8000 chars to stay within token limits
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error creating embedding:', error);
    // Fallback to mock embedding
    return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
  }
}


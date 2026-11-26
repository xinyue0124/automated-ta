import OpenAI from 'openai';
import dotenv from 'dotenv';
import pool from '../config/database.js';
import { searchRelevantChunks } from './documentProcessor.js';

dotenv.config();

// Any OpenAI-compatible API: set OPENAI_BASE_URL (read by the SDK) and AI_MODEL, e.g. DeepSeek.
export const AI_MODEL = process.env.AI_MODEL || 'gpt-4';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function formatContext(relevantChunks) {
  if (relevantChunks.length === 0) return '';
  return 'Based on your notes:\n\n' +
    relevantChunks.map((chunk, idx) => `[Note ${idx + 1}]:\n${chunk.content}\n\n`).join('');
}

// The prompt the model sees: system instructions, the retrieved notes, the recent conversation,
// then the question. Exported so the eval scores exactly what the app sends.
export function buildMessages(userMessage, relevantChunks, history = []) {
  const context = formatContext(relevantChunks);
  const messages = [
    {
      role: 'system',
      content: `You are a helpful teaching assistant. ${
        context
          ? 'Answer only from the student\'s uploaded notes below, and say which note you used. Do not add facts, rules or advice that are not in the notes. If the notes do not answer the question, say that your notes do not cover it and stop: do not answer from general knowledge.'
          : 'The student hasn\'t uploaded any notes yet. Encourage them to upload their class notes for personalized assistance.'
      }`
    }
  ];
  if (context) messages.push({ role: 'system', content: context });
  for (const msg of history) {
    if (msg.role !== 'system') messages.push({ role: msg.role, content: msg.content });
  }
  messages.push({ role: 'user', content: userMessage });
  return messages;
}

export async function completeChat(messages) {
  const completion = await openai.chat.completions.create({
    model: AI_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 500
  });
  return completion.choices[0].message.content;
}

export async function generateAIResponse(userMessage, userId, sessionId) {
  try {
    // Search for relevant context from user's notes
    const relevantChunks = await searchRelevantChunks(userMessage, userId, 3);

    if (!openai) {
      // Mock response when OpenAI is not configured
      const context = formatContext(relevantChunks);
      return `I understand you're asking about: "${userMessage}"\n\n${
        context
          ? `I found these relevant sections from your notes:\n${context}\n\n`
          : 'To provide personalized help based on your class notes, please upload your notes using the file upload button.\n\n'
      }Note: This is a demo response. Configure your OpenAI API key in the backend .env file to get AI-powered responses.`;
    }

    // Get recent conversation history
    const historyResult = await pool.query(
      `SELECT role, content FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [sessionId]
    );

    return await completeChat(buildMessages(userMessage, relevantChunks, historyResult.rows.reverse()));
  } catch (error) {
    console.error('Error generating AI response:', error);
    return 'I apologize, but I encountered an error generating a response. Please try again.';
  }
}

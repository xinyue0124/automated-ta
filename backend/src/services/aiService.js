import OpenAI from 'openai';
import dotenv from 'dotenv';
import pool from '../config/database.js';
import { searchRelevantChunks } from './documentProcessor.js';

dotenv.config();

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function generateAIResponse(userMessage, userId, sessionId) {
  try {
    // Search for relevant context from user's notes
    const relevantChunks = await searchRelevantChunks(userMessage, userId, 3);
    
    // Build context from relevant chunks
    let context = '';
    if (relevantChunks.length > 0) {
      context = 'Based on your notes:\n\n';
      relevantChunks.forEach((chunk, idx) => {
        context += `[Note ${idx + 1}]:\n${chunk.content}\n\n`;
      });
    }

    // Get recent conversation history
    const historyResult = await pool.query(
      `SELECT role, content FROM chat_messages 
       WHERE session_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [sessionId]
    );

    const conversationHistory = historyResult.rows.reverse();

    if (!openai) {
      // Mock response when OpenAI is not configured
      return `I understand you're asking about: "${userMessage}"\n\n${
        context 
          ? `I found these relevant sections from your notes:\n${context}\n\n` 
          : 'To provide personalized help based on your class notes, please upload your notes using the file upload button.\n\n'
      }Note: This is a demo response. Configure your OpenAI API key in the backend .env file to get AI-powered responses.`;
    }

    // Build messages for OpenAI
    const messages = [
      {
        role: 'system',
        content: `You are a helpful teaching assistant. ${
          context 
            ? 'Use the student\'s uploaded notes as context to provide personalized help. Reference specific parts of their notes when relevant.' 
            : 'The student hasn\'t uploaded any notes yet. Encourage them to upload their class notes for personalized assistance.'
        }`
      }
    ];

    if (context) {
      messages.push({
        role: 'system',
        content: context
      });
    }

    // Add conversation history
    conversationHistory.forEach(msg => {
      if (msg.role !== 'system') {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    });

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage
    });

    // Generate response
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.7,
      max_tokens: 500
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error generating AI response:', error);
    return 'I apologize, but I encountered an error generating a response. Please try again.';
  }
}


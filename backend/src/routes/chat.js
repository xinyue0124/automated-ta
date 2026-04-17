import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';
import { generateAIResponse } from '../services/aiService.js';

const router = express.Router();

// Create new chat session
router.post('/sessions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title } = req.body;

    const result = await pool.query(
      'INSERT INTO chat_sessions (user_id, title) VALUES ($1, $2) RETURNING *',
      [userId, title || 'New Chat']
    );

    res.status(201).json({
      session: {
        id: result.rows[0].id,
        title: result.rows[0].title,
        createdAt: result.rows[0].created_at
      }
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create chat session' });
  }
});

// Get user's chat sessions
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await pool.query(
      'SELECT id, title, created_at, updated_at FROM chat_sessions WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );

    res.json({
      sessions: result.rows.map(s => ({
        id: s.id,
        title: s.title,
        createdAt: s.created_at,
        updatedAt: s.updated_at
      }))
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get messages for a session
router.get('/sessions/:sessionId/messages', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    // Verify session belongs to user
    const sessionCheck = await pool.query(
      'SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const result = await pool.query(
      'SELECT id, role, content, created_at FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
      [sessionId]
    );

    res.json({
      messages: result.rows.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at
      }))
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send message in a chat session
router.post('/sessions/:sessionId/messages', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content required' });
    }

    // Verify session belongs to user
    const sessionCheck = await pool.query(
      'SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Save user message
    const userMessage = await pool.query(
      'INSERT INTO chat_messages (session_id, user_id, role, content) VALUES ($1, $2, $3, $4) RETURNING *',
      [sessionId, userId, 'user', content]
    );

    // Generate AI response with context from user's notes
    const aiResponse = await generateAIResponse(content, userId, sessionId);

    // Save AI message
    const aiMessage = await pool.query(
      'INSERT INTO chat_messages (session_id, user_id, role, content) VALUES ($1, $2, $3, $4) RETURNING *',
      [sessionId, userId, 'assistant', aiResponse]
    );

    // Update session timestamp
    await pool.query(
      'UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [sessionId]
    );

    res.json({
      userMessage: {
        id: userMessage.rows[0].id,
        role: userMessage.rows[0].role,
        content: userMessage.rows[0].content,
        createdAt: userMessage.rows[0].created_at
      },
      aiMessage: {
        id: aiMessage.rows[0].id,
        role: aiMessage.rows[0].role,
        content: aiMessage.rows[0].content,
        createdAt: aiMessage.rows[0].created_at
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Delete chat session
router.delete('/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    await pool.query(
      'DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;


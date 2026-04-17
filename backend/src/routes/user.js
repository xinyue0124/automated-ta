import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(
      'SELECT id, email, full_name, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get user stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [documentsCount, sessionsCount, messagesCount] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM documents WHERE user_id = $1', [userId]),
      pool.query('SELECT COUNT(*) FROM chat_sessions WHERE user_id = $1', [userId]),
      pool.query('SELECT COUNT(*) FROM chat_messages WHERE user_id = $1', [userId])
    ]);

    res.json({
      stats: {
        documentsUploaded: parseInt(documentsCount.rows[0].count),
        chatSessions: parseInt(sessionsCount.rows[0].count),
        totalMessages: parseInt(messagesCount.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;


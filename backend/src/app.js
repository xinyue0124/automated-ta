import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import fileRoutes from './routes/files.js';
import chatRoutes from './routes/chat.js';
import userRoutes from './routes/user.js';

// Builds the Express app without starting a server, so tests can drive it directly.
export function createApp({ authRateLimitMax = 20 } = {}) {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      process.env.CORS_ORIGIN
    ].filter(Boolean),
    credentials: true
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Slow down password guessing: cap sign-in and sign-up attempts per IP.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: authRateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts, please try again later' }
  });

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/user', userRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
      error: {
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      }
    });
  });

  return app;
}

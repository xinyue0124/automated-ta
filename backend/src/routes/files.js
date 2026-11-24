import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';
import { processDocument } from '../services/documentProcessor.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = './uploads';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.pptx', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, DOCX, PPTX, TXT, MD'));
    }
  }
});

// Upload file
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { filename, originalname, mimetype, size, path: filePath } = req.file;
    const userId = req.user.userId;

    // Save file metadata to database
    const result = await pool.query(
      `INSERT INTO documents (user_id, filename, original_name, file_type, file_size)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, filename, originalname, mimetype, size]
    );

    const document = result.rows[0];

    // Process document in background (extract text and create embeddings)
    processDocument(document.id, filePath, userId).catch(err => {
      console.error('Error processing document:', err);
    });

    res.status(201).json({
      message: 'File uploaded successfully',
      document: {
        id: document.id,
        filename: document.original_name,
        fileType: document.file_type,
        fileSize: document.file_size,
        uploadDate: document.upload_date,
        processed: document.processed
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get user's documents
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await pool.query(
      `SELECT id, original_name, file_type, file_size, upload_date, processed
       FROM documents
       WHERE user_id = $1
       ORDER BY upload_date DESC`,
      [userId]
    );

    res.json({
      documents: result.rows.map(doc => ({
        id: doc.id,
        filename: doc.original_name,
        fileType: doc.file_type,
        fileSize: doc.file_size,
        uploadDate: doc.upload_date,
        processed: doc.processed
      }))
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Delete document
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.userId;

    // Get document info
    const docResult = await pool.query(
      'SELECT filename FROM documents WHERE id = $1 AND user_id = $2',
      [documentId, userId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete file from filesystem
    const filename = docResult.rows[0].filename;
    try {
      await fs.unlink(`./uploads/${filename}`);
    } catch (err) {
      console.error('Error deleting file:', err);
    }

    // Delete from database (cascades to chunks)
    await pool.query('DELETE FROM documents WHERE id = $1 AND user_id = $2', [documentId, userId]);

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;


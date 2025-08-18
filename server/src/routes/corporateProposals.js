// server/src/routes/corporateProposals.js  (ESM)

import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { pool } from '../db/pool.js';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = express.Router();

// __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/**
 * IMPORTANT:
 * - Static middleware in index.js serves:  path.resolve(__dirname, '..', 'uploads')  from index.js (server/src) -> server/uploads
 * - We must write files to the SAME folder: server/uploads
 * - From here (server/src/routes), that's ../../uploads
 */
const UPLOAD_ROOT = path.resolve(__dirname, '..', '..', 'uploads');
const UPLOAD_DIR  = path.join(UPLOAD_ROOT, 'corporate', 'proposals');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeOriginal = file.originalname.replace(/[^\w.-]/g, '_');
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}_${safeOriginal}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDF files are allowed'));
    cb(null, true);
  },
});

// POST /api/corporate/leads/proposals/upload
router.post(
  '/upload',
  authRequired,
  requireRole('corporate_manager'),
  upload.single('file'),
  async (req, res) => {
    try {
      const { corporate_lead_id } = req.body;
      if (!corporate_lead_id || !req.file) {
        return res.status(400).json({ error: 'corporate_lead_id and file are required' });
      }

      // Build the URL path the static middleware serves
      const storedRelPath = path.posix.join(
        '/uploads', 'corporate', 'proposals', path.basename(req.file.path)
      );

      const q = `
        INSERT INTO corporate_lead_documents
          (corporate_lead_id, doc_type, file_name, stored_path, mime_type, file_size, uploaded_by)
        VALUES ($1,'proposal',$2,$3,$4,$5,$6)
        RETURNING doc_id, corporate_lead_id, doc_type, file_name, stored_path, mime_type, file_size, uploaded_at
      `;
      const { rows } = await pool.query(q, [
        Number(corporate_lead_id),
        req.file.originalname,
        storedRelPath,
        req.file.mimetype,
        req.file.size,
        req.user?.user_id ?? null,
      ]);

      const file_url = `${req.protocol}://${req.get('host')}${storedRelPath}`;
      res.status(201).json({ ...rows[0], file_url });
    } catch (e) {
      console.error('proposal upload error', e);
      res.status(500).json({ error: e.message || 'Upload failed' });
    }
  }
);

// GET /api/corporate/leads/proposals/:leadId
router.get('/:leadId', authRequired, requireRole('corporate_manager'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT doc_id, corporate_lead_id, doc_type, file_name, stored_path, mime_type, file_size, uploaded_at
       FROM corporate_lead_documents
       WHERE corporate_lead_id = $1 AND doc_type = 'proposal'
       ORDER BY uploaded_at DESC`,
      [req.params.leadId]
    );
    const withUrls = rows.map(r => ({
      ...r,
      file_url: `${req.protocol}://${req.get('host')}${r.stored_path}`,
    }));
    res.json(withUrls);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to load proposals' });
  }
});

export { router as corporateProposalsRouter };
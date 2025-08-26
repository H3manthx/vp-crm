// server/src/routes/corporateProposals.js  (ESM)
import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { Storage } from '@google-cloud/storage';

// CJS interop for pool + auth (same pattern you use elsewhere)
import db from '../db/pool.js';
const { pool } = db;

import auth from '../middleware/auth.js';
const { authRequired, requireRole } = auth;

const router = express.Router();

// ---------- GCS setup ----------
const storage = new Storage();               // uses Cloud Run service account
const BUCKET = process.env.GCS_BUCKET || ''; // set this in Cloud Run env

function safeName(original = 'file.pdf') {
  return original.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_');
}

function objectName(original) {
  const rand = crypto.randomBytes(6).toString('hex');
  return `corporate/proposals/${Date.now()}_${rand}_${safeName(original)}`;
}

function publicUrl(bucket, obj) {
  // Works if bucket allows public reads (or if you later serve via signed URLs)
  return `https://storage.googleapis.com/${bucket}/${encodeURI(obj)}`;
}

// Use memory storage — we stream to GCS
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf')
      return cb(new Error('Only PDF files are allowed'));
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
      if (!BUCKET) return res.status(500).json({ error: 'GCS_BUCKET not configured' });

      const { corporate_lead_id } = req.body;
      if (!corporate_lead_id || !req.file) {
        return res.status(400).json({ error: 'corporate_lead_id and file are required' });
      }

      // Enforce ownership: only the lead's manager can upload
      const own = await pool.query(
        `SELECT 1 FROM corporate_leads WHERE corporate_lead_id = $1 AND manager_id = $2`,
        [Number(corporate_lead_id), req.user.user_id]
      );
      if (!own.rowCount) return res.status(404).json({ error: 'Lead not found' });

      const obj = objectName(req.file.originalname);
      const bucket = storage.bucket(BUCKET);
      const file = bucket.file(obj);

      // Upload buffer to GCS
      await file.save(req.file.buffer, {
        contentType: req.file.mimetype,
        resumable: false,
        metadata: { cacheControl: 'public, max-age=3600' },
      });

      const url = publicUrl(BUCKET, obj);

      // Store the absolute URL in stored_path for maximum client compatibility
      const q = `
        INSERT INTO corporate_lead_documents
          (corporate_lead_id, doc_type, file_name, stored_path, mime_type, file_size, uploaded_by)
        VALUES ($1,'proposal',$2,$3,$4,$5,$6)
        RETURNING doc_id, corporate_lead_id, doc_type, file_name, stored_path, mime_type, file_size, uploaded_at
      `;
      const { rows } = await pool.query(q, [
        Number(corporate_lead_id),
        req.file.originalname,
        url,
        req.file.mimetype,
        req.file.size,
        req.user?.user_id ?? null,
      ]);

      res.status(201).json({ ...rows[0], file_url: url });
    } catch (e) {
      console.error('proposal upload error', e);
      res.status(500).json({ error: e.message || 'Upload failed' });
    }
  }
);

// GET /api/corporate/leads/proposals/:leadId
router.get(
  '/:leadId',
  authRequired,
  requireRole('corporate_manager'),
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT d.doc_id, d.corporate_lead_id, d.doc_type, d.file_name, d.stored_path,
                d.mime_type, d.file_size, d.uploaded_at
           FROM corporate_lead_documents d
           JOIN corporate_leads l ON l.corporate_lead_id = d.corporate_lead_id
          WHERE d.corporate_lead_id = $1
            AND d.doc_type = 'proposal'
            AND l.manager_id = $2
          ORDER BY d.uploaded_at DESC`,
        [req.params.leadId, req.user.user_id]
      );

      const normalized = rows.map(r => {
        const sp = r.stored_path || '';
        const href = /^https?:\/\//.test(sp)
          ? sp
          : (BUCKET ? publicUrl(BUCKET, sp) : sp);
        return { ...r, file_url: href };
      });

      res.json(normalized);
    } catch (e) {
      res.status(500).json({ error: e.message || 'Failed to load proposals' });
    }
  }
);

export { router as corporateProposalsRouter };

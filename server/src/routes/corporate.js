import { Router } from 'express';
import { z } from 'zod';

// CJS interop: import default and destructure
import db from '../db/pool.js';
const { pool } = db;

import auth from '../middleware/auth.js';
const { authRequired, requireRole } = auth;

export const corporateRouter = Router();

const CorpLeadSchema = z.object({
  name: z.string().min(2),
  contact_number: z.string().min(5),
  email: z.string().email().optional().nullable(),
  enquiry_date: z.string().optional().nullable(),
});

// Create
corporateRouter.post(
  '/leads',
  authRequired,
  requireRole('corporate_manager'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const data = CorpLeadSchema.parse(req.body);

      await client.query('BEGIN');

      const insLead = await client.query(
        `
        INSERT INTO corporate_leads (name, contact_number, email, status, manager_id, enquiry_date)
        VALUES ($1,$2,$3,'New',$4, COALESCE($5::date, CURRENT_DATE))
        RETURNING corporate_lead_id, enquiry_date
        `,
        [data.name, data.contact_number, data.email ?? null, req.user.user_id, data.enquiry_date ?? null]
      );

      const newId = insLead.rows[0].corporate_lead_id;

      await client.query(
        `INSERT INTO corporate_lead_status_history (corporate_lead_id, status, notes, updated_by)
         VALUES ($1,'New','Lead created',$2)`,
        [newId, req.user.user_id]
      );

      await client.query(
        `INSERT INTO corporate_lead_reminders (corporate_lead_id, remind_at, reminder_type, notes)
         VALUES ($1, NOW() + INTERVAL '3 days', 'lead_checkin', 'Check in on new lead')`,
        [newId]
      );

      await client.query('COMMIT');
      res.status(201).json(insLead.rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: e.message });
    } finally {
      client.release();
    }
  }
);

// Analytics
corporateRouter.get(
  '/analytics/summary',
  authRequired,
  requireRole('corporate_manager'),
  async (_req, res) => {
    try {
      const frame = 'quarter'; // you can add ?period=month if desired

      const wonSql = `
        SELECT COUNT(*)::int AS won_count
        FROM corporate_leads
        WHERE status='Closed Won'
          AND closed_date >= date_trunc('${frame}', CURRENT_DATE);
      `;
      const openSql = `
        SELECT COUNT(*)::int AS open_count
        FROM corporate_leads
        WHERE status NOT IN ('Closed Won','Closed Lost');
      `;
      const pipeSql = `
        SELECT COUNT(*)::int AS pipeline_count
        FROM corporate_leads
        WHERE status IN ('Open','In Progress');
      `;

      const [{ rows: A }, { rows: B }, { rows: C }] = await Promise.all([
        pool.query(wonSql),
        pool.query(openSql),
        pool.query(pipeSql),
      ]);

      res.json({
        period: frame,
        won_count: A[0].won_count,
        open_count: B[0].open_count,
        pipeline_count: C[0].pipeline_count,
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
);

// List
corporateRouter.get(
  '/leads',
  authRequired,
  requireRole('corporate_manager'),
  async (req, res) => {
    try {
      const { q, status, limit = 20, offset = 0 } = req.query;

      const where = ['manager_id = $1'];        // <— own leads only
      const params = [req.user.user_id];
      let i = 2;

      if (status) {
        where.push(`status = $${i++}`);
        params.push(status);
      }
      if (q) {
        where.push(`(
          name ILIKE $${i} OR
          COALESCE(email,'') ILIKE $${i} OR
          contact_number ILIKE $${i}
        )`);
        params.push(`%${q}%`);
        i++;
      }

      const whereSql = `WHERE ${where.join(' AND ')}`;

      const countSql = `SELECT COUNT(*)::int AS total FROM corporate_leads ${whereSql}`;
      const { rows: cRows } = await pool.query(countSql, params);
      const total = cRows[0]?.total ?? 0;

      const lim = Math.min(Number(limit) || 20, 100);
      const off = Math.max(Number(offset) || 0, 0);

      const sql = `
        SELECT corporate_lead_id, name, contact_number, email, status, enquiry_date
        FROM corporate_leads
        ${whereSql}
        ORDER BY corporate_lead_id DESC
        LIMIT ${lim} OFFSET ${off}
      `;
      const { rows } = await pool.query(sql, params);

      res.json({ data: rows, total, limit: lim, offset: off });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
);

// Update
const CorpUpdateSchema = z.object({
  corporate_lead_id: z.number().int(),
  name: z.string().min(2).optional(),
  contact_number: z.string().min(5).optional(),
  email: z.string().email().optional(),
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
});

corporateRouter.put(
  '/leads',
  authRequired,
  requireRole('corporate_manager'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const data = CorpUpdateSchema.parse(req.body);
      const fields = [];
      const params = [];
      let i = 1;

      for (const key of ['name', 'contact_number', 'email', 'status']) {
        if (data[key] !== undefined) {
          fields.push(`${key} = $${i++}`);
          params.push(data[key]);
        }
      }
      if (fields.length === 0)
        return res.status(400).json({ error: 'No fields to update' });
      params.push(data.corporate_lead_id);

      await client.query('BEGIN');
      const q = `UPDATE corporate_leads SET ${fields.join(', ')}
                 WHERE corporate_lead_id = $${i} RETURNING *`;
      const { rows } = await client.query(q, params);

      if (Object.prototype.hasOwnProperty.call(data, 'status')) {
        const notes =
          typeof data.notes === 'string' && data.notes.trim()
            ? data.notes.trim()
            : null;
        await client.query(
          `INSERT INTO corporate_lead_status_history (corporate_lead_id, status, notes, updated_by)
           VALUES ($1,$2,$3,$4)`,
          [data.corporate_lead_id, data.status, notes, req.user.user_id]
        );
      }

      await client.query('COMMIT');
      res.json(rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: e.message });
    } finally {
      client.release();
    }
  }
);

// Items
const ItemSchema = z.object({
  corporate_lead_id: z.number().int(),
  bill_of_material: z.string().min(1),
  quantity: z.number().int().min(1),
  requirements: z.string().optional().nullable(),
});

corporateRouter.post(
  '/leads/items',
  authRequired,
  requireRole('corporate_manager'),
  async (req, res) => {
    try {
      const d = ItemSchema.parse(req.body);
      const q = `INSERT INTO corporate_lead_items (corporate_lead_id, bill_of_material, quantity, requirements)
                 VALUES ($1,$2,$3,$4) RETURNING item_id`;
      const { rows } = await pool.query(q, [
        d.corporate_lead_id,
        d.bill_of_material,
        d.quantity,
        d.requirements ?? null,
      ]);
      res.status(201).json(rows[0]);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
);

const ItemUpdateSchema = z.object({
  item_id: z.number().int(),
  bill_of_material: z.string().optional(),
  quantity: z.number().int().min(1).optional(),
  requirements: z.string().optional().nullable(),
});

corporateRouter.put(
  '/leads/items',
  authRequired,
  requireRole('corporate_manager'),
  async (req, res) => {
    try {
      const d = ItemUpdateSchema.parse(req.body);
      const fields = [];
      const params = [];
      let i = 1;
      for (const k of ['bill_of_material', 'quantity', 'requirements']) {
        if (d[k] !== undefined) {
          fields.push(`${k}=$${i++}`);
          params.push(d[k]);
        }
      }
      if (!fields.length) return res.status(400).json({ error: 'No fields' });
      params.push(d.item_id);
      const q = `UPDATE corporate_lead_items SET ${fields.join(', ')},
                 last_updated = NOW() WHERE item_id = $${i} RETURNING *`;
      const { rows } = await pool.query(q, params);
      res.json(rows[0]);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
);

// Close deal
const CloseSchema = z.object({
  corporate_lead_id: z.number().int(),
  status: z.enum(['Closed Won', 'Closed Lost']),
  notes: z.string().optional().nullable(),
  value_closed: z.number().optional(),
});

corporateRouter.post(
  '/leads/close',
  authRequired,
  requireRole('corporate_manager'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { corporate_lead_id, status, notes, value_closed } =
        CloseSchema.parse(req.body);
      await client.query('BEGIN');

      await client.query(
        `UPDATE corporate_leads SET status=$1, closed_date = CURRENT_DATE WHERE corporate_lead_id=$2`,
        [status, corporate_lead_id]
      );

      const combinedNotes =
        (notes?.trim() || '') +
        (value_closed != null
          ? (notes ? ' ' : '') +
            `(Deal value ₹${Number(value_closed).toLocaleString('en-IN')})`
          : '');

      await client.query(
        `INSERT INTO corporate_lead_status_history (corporate_lead_id, status, notes, updated_by)
         VALUES ($1,$2,$3,$4)`,
        [corporate_lead_id, status, combinedNotes || null, req.user.user_id]
      );

      await client.query(
        `INSERT INTO corporate_lead_reminders (corporate_lead_id, remind_at, reminder_type, notes)
         VALUES ($1, NOW() + INTERVAL '7 days', 'follow_up', 'Auto scheduled 1-week follow-up')`,
        [corporate_lead_id]
      );

      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: e.message });
    } finally {
      client.release();
    }
  }
);

// History (ownership enforced)
corporateRouter.get(
  '/leads/history/:leadId',
  authRequired,
  requireRole('corporate_manager'),
  async (req, res) => {
    try {
      const id = Number(req.params.leadId);
      if (!Number.isInteger(id))
        return res.status(400).json({ error: 'Invalid lead id' });

      const sql = `
        SELECT h.status_id,
               h.corporate_lead_id,
               h.status,
               h.notes,
               h.updated_by,
               h.update_timestamp,
               e.name AS updated_by_name
        FROM corporate_lead_status_history h
        JOIN corporate_leads l ON l.corporate_lead_id = h.corporate_lead_id
        LEFT JOIN employees e ON e.employee_id = h.updated_by
        WHERE h.corporate_lead_id = $1
          AND l.manager_id = $2
        ORDER BY h.update_timestamp DESC
      `;
      const { rows } = await pool.query(sql, [id, req.user.user_id]);
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: 'Failed to load history' });
    }
  }
);

// One lead + items (ownership enforced)
corporateRouter.get(
  '/leads/:leadId',
  authRequired,
  requireRole('corporate_manager'),
  async (req, res) => {
    try {
      const id = Number(req.params.leadId);
      if (!Number.isInteger(id))
        return res.status(400).json({ error: 'Invalid lead id' });

      const { rows } = await pool.query(
        `SELECT corporate_lead_id, name, contact_number, email, status, enquiry_date,
                last_quoted_value, last_quoted_at, manager_id
         FROM corporate_leads
         WHERE corporate_lead_id = $1 AND manager_id = $2`,
        [id, req.user.user_id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Lead not found' });

      const items = await pool.query(
        `SELECT item_id, bill_of_material, quantity, requirements, last_updated
         FROM corporate_lead_items
         WHERE corporate_lead_id = $1
         ORDER BY item_id ASC`,
        [id]
      );

      const lead = rows[0];
      lead.items = items.rows || [];
      res.json(lead);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
);

// Reminders list
corporateRouter.get(
  '/reminders',
  authRequired,
  requireRole('corporate_manager'),
  async (req, res) => {
    try {
      const windowDays = Math.min(Math.max(Number(req.query.window_days) || 14, 1), 60);
      const dueOnly = String(req.query.due_only || '0') === '1';

      const params = [req.user.user_id, windowDays];
      const rowsSql = `
        SELECT
          r.reminder_id,
          r.corporate_lead_id,
          r.remind_at,
          r.reminder_type,
          r.notes,
          r.done,
          l.name,
          l.status,
          l.enquiry_date
        FROM corporate_lead_reminders r
        JOIN corporate_leads l ON l.corporate_lead_id = r.corporate_lead_id
        WHERE l.manager_id = $1
          AND r.done = false
          AND r.remind_at <= NOW() + ($2 || ' days')::interval
          ${dueOnly ? 'AND r.remind_at <= NOW()' : ''}
        ORDER BY r.remind_at ASC, r.reminder_id ASC
        LIMIT 200
      `;
      const { rows } = await pool.query(rowsSql, params);
      res.json(rows);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
);

// Reminders ack
corporateRouter.post(
  '/reminders/ack',
  authRequired,
  requireRole('corporate_manager'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { reminder_id } = req.body || {};
      if (!Number.isInteger(reminder_id)) {
        return res.status(400).json({ error: 'reminder_id is required' });
      }

      await client.query('BEGIN');

      const { rows } = await client.query(
        `
        SELECT r.reminder_id, r.corporate_lead_id, r.reminder_type, r.remind_at, r.done,
               l.status
        FROM corporate_lead_reminders r
        JOIN corporate_leads l ON l.corporate_lead_id = r.corporate_lead_id
        WHERE r.reminder_id = $1
        FOR UPDATE
        `,
        [reminder_id]
      );
      if (!rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Reminder not found' });
      }
      const row = rows[0];

      await client.query(
        `UPDATE corporate_lead_reminders SET done = true WHERE reminder_id = $1`,
        [reminder_id]
      );

      const isOpen = !['Closed Won', 'Closed Lost'].includes(row.status);
      if (row.reminder_type === 'lead_checkin' && isOpen) {
        await client.query(
          `INSERT INTO corporate_lead_reminders (corporate_lead_id, remind_at, reminder_type, notes)
           VALUES ($1, NOW() + INTERVAL '3 days', 'lead_checkin', 'Recurring 3-day check-in')`,
          [row.corporate_lead_id]
        );
      }

      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: e.message });
    } finally {
      client.release();
    }
  }
);
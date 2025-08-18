const express = require('express');
const { pool } = require('../db/pool');
const { authRequired, requireRole } = require('../middleware/auth');

const remindersRouter = express.Router();

// Retail: list reminders for the logged-in sales (their assigned leads)
remindersRouter.get('/retail', authRequired, async (req, res) => {
  try {
    if (req.user.role === 'sales') {
      const { rows } = await pool.query(
        `SELECT r.reminder_id, r.lead_id, r.remind_at, r.reason, r.done,
                l.name as lead_name, l.status
         FROM retail_lead_reminders r
         JOIN leads l ON l.lead_id = r.lead_id
         WHERE r.done = FALSE AND l.assigned_to = $1
         ORDER BY r.remind_at DESC
         LIMIT 200`,
        [req.user.user_id]
      );
      return res.json(rows);
    }
    // managers: see reminders in their domain (untouched 3 days)
    if (['laptop_manager', 'pc_manager'].includes(req.user.role)) {
      const category = req.user.role === 'laptop_manager' ? 'laptop' : 'pc_component';
      const { rows } = await pool.query(
        `SELECT r.reminder_id, r.lead_id, r.remind_at, r.reason, r.done,
                l.name as lead_name, l.status
         FROM retail_lead_reminders r
         JOIN leads l ON l.lead_id = r.lead_id
         WHERE r.done = FALSE
           AND EXISTS (SELECT 1 FROM lead_items li WHERE li.lead_id = l.lead_id AND li.category = $1)
         ORDER BY r.remind_at DESC
         LIMIT 200`,
        [category]
      );
      return res.json(rows);
    }
    res.json([]); // other roles: nothing for now
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Retail: mark done
remindersRouter.post('/retail/done', authRequired, async (req, res) => {
  try {
    const { reminder_id } = req.body;
    await pool.query(`UPDATE retail_lead_reminders SET done = TRUE WHERE reminder_id = $1`, [reminder_id]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Corporate: list (corporate_manager only)
remindersRouter.get('/corporate', authRequired, requireRole('corporate_manager'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.reminder_id, r.corporate_lead_id, r.remind_at, r.reminder_type, r.done, r.notes,
              c.name as contact_name, c.status
       FROM corporate_lead_reminders r
       JOIN corporate_leads c ON c.corporate_lead_id = r.corporate_lead_id
       WHERE r.done = FALSE
       ORDER BY r.remind_at DESC
       LIMIT 200`
    );
    res.json(rows);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Corporate: mark done
remindersRouter.post('/corporate/done', authRequired, requireRole('corporate_manager'), async (req, res) => {
  try {
    const { reminder_id } = req.body;
    await pool.query(`UPDATE corporate_lead_reminders SET done = TRUE WHERE reminder_id = $1`, [reminder_id]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = { remindersRouter };
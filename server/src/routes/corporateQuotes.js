// server/src/routes/corporateQuotes.js
const express = require('express');
const { pool } = require('../db/pool');

const corporateQuotesRouter = express.Router();

// POST /api/corporate/leads/quotes
// Create a new quotation and update last_quoted_* on the lead
corporateQuotesRouter.post('/', async (req, res) => {
  const { corporate_lead_id, amount, notes } = req.body;

  if (!corporate_lead_id || amount == null) {
    return res
      .status(400)
      .json({ error: 'corporate_lead_id and amount are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ins = await client.query(
      `INSERT INTO corporate_lead_quotes (corporate_lead_id, amount, notes)
       VALUES ($1, $2, $3)
       RETURNING quote_id, corporate_lead_id, amount, notes, created_at`,
      [corporate_lead_id, amount, notes || null]
    );

    await client.query(
      `UPDATE corporate_leads
       SET last_quoted_value = $2, last_quoted_at = NOW()
       WHERE corporate_lead_id = $1`,
      [corporate_lead_id, amount]
    );

    await client.query('COMMIT');
    res.json(ins.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('create quote error', err);
    res.status(500).json({ error: 'Failed to create quote' });
  } finally {
    client.release();
  }
});

// GET /api/corporate/leads/quotes/:leadId
// List all quotes for a lead (newest first)
corporateQuotesRouter.get('/:leadId', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT quote_id, corporate_lead_id, amount, notes, created_at
       FROM corporate_lead_quotes
       WHERE corporate_lead_id = $1
       ORDER BY created_at DESC`,
      [req.params.leadId]
    );
    res.json(r.rows);
  } catch (err) {
    console.error('list quotes error', err);
    res.status(500).json({ error: 'Failed to load quotes' });
  }
});

module.exports = { corporateQuotesRouter };
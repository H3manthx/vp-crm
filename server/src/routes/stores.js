const express = require('express');
const { pool } = require('../db/pool');

const storesRouter = express.Router();

// public list of stores: [{ store_id, name }]
storesRouter.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT store_id, name FROM stores ORDER BY name ASC'
    );
    res.json(rows);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = { storesRouter };

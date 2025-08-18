const express = require('express');
const { pool } = require('../db/pool');
const { authRequired, requireRole } = require('../middleware/auth');
const router = express.Router();

// List employees (optionally only sales), with search and store filter.
// Accessible to managers.
router.get('/', authRequired, requireRole('laptop_manager','pc_manager','corporate_manager'), async (req,res)=>{
  try{
    const { sales_only, store_id, q } = req.query;

    const where = [];
    const params = [];
    if (sales_only) where.push(`role = 'sales'`);
    if (store_id) { params.push(Number(store_id)); where.push(`store_id = $${params.length}`); }
    if (q)       { params.push(`%${q}%`); where.push(`(LOWER(name) LIKE LOWER($${params.length}) OR LOWER(email) LIKE LOWER($${params.length}) )`); }

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `
      SELECT employee_id, name, email, role, store_id
      FROM employees
      ${whereSQL}
      ORDER BY name NULLS LAST, email ASC
      LIMIT 200;
    `;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  }catch(e){ res.status(400).json({error:e.message}); }
});

module.exports = { employeesRouter: router };
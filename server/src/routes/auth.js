// server/src/routes/auth.js (CJS)
const express = require('express');
const { z } = require('zod');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');

const authRouter = express.Router();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RegisterSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8),
  store_id: z.number().int().positive().nullable().optional(), // optional
});

// --- LOGIN ---
authRouter.post('/login', async (req,res)=>{
  try{
    const { email, password } = LoginSchema.parse(req.body);
    const normEmail = email.trim().toLowerCase();

    const { rows } = await pool.query(
      'SELECT * FROM employees WHERE email=$1',
      [normEmail]
    );
    const user = rows[0];
    if(!user) return res.status(401).json({error:'Invalid credentials'});

    const ok = await bcrypt.compare(password, user.password || '');
    if(!ok) return res.status(401).json({error:'Invalid credentials'});

    const token = jwt.sign(
      { user_id: user.employee_id, role: user.role, store_id: user.store_id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.employee_id,
        name: user.name,
        email: user.email,
        role: user.role,
        store_id: user.store_id
      }
    });
  }catch(e){
    // zod errors or others
    res.status(400).json({error: e?.issues?.[0]?.message || e.message || 'Bad request'});
  }
});

// --- REGISTER ---
authRouter.post('/register', async (req,res)=>{
  try{
    const parsed = RegisterSchema.parse(req.body);
    const name = parsed.name.trim();
    const email = parsed.email.trim().toLowerCase();
    const password = parsed.password;
    const storeId = parsed.store_id ?? null;

    // Ensure email unique
    const existing = await pool.query('SELECT 1 FROM employees WHERE email=$1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);

    // Default role: 'sales' unless you pass something else during employee admin creation
    const insertSql = `
      INSERT INTO employees (name, email, password, role, store_id)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING employee_id, name, email, role, store_id
    `;
    const { rows } = await pool.query(insertSql, [name, email, hash, 'sales', storeId]);

    // Keep your current UX: no auto-login after register
    res.status(201).json({ user: rows[0] });
  }catch(e){
    res.status(400).json({error: e?.issues?.[0]?.message || e.message || 'Bad request'});
  }
});

module.exports = { authRouter };

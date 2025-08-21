// server/src/routes/retail.js  (CJS)
const express = require('express');
const { pool } = require('../db/pool');
const { authRequired, requireRole } = require('../middleware/auth');

const retailRouter = express.Router();

/* ----------------------------- HELPERS ----------------------------- */

function getManagerDomain(role) {
  if (role === 'laptop_manager') return 'laptop';
  if (role === 'pc_manager') return 'pc_component';
  return null;
}

/* -------------------------- CREATE RETAIL LEAD -------------------------- */

retailRouter.post(
  '/leads',
  authRequired,
  requireRole('sales', 'laptop_manager', 'pc_manager'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const {
        store_id = null,
        name,
        contact_number,
        email = null,
        source = null,
        source_detail = null,
        items = [],
      } = req.body || {};

      if (!name || !contact_number) {
        return res.status(400).json({ error: 'name and contact_number are required' });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'at least one item is required' });
      }

      const normItems = items.map((it) => ({
        item_description: it.item_description ?? null,
        category: (it.category || '').toLowerCase(),
        brand: it.brand,
        quantity: Number(it.quantity || 1),
      }));

      const allowed = new Set(['laptop', 'pc_component']);
      for (const it of normItems) {
        if (!allowed.has(it.category)) {
          return res.status(400).json({ error: `invalid category: ${it.category}` });
        }
        if (!it.brand) return res.status(400).json({ error: 'brand is required for each item' });
        if (it.quantity < 1) return res.status(400).json({ error: 'quantity must be >= 1' });
      }

      const role = req.user.role;
      const mgrDomain =
        role === 'laptop_manager' ? 'laptop' : role === 'pc_manager' ? 'pc_component' : null;
      if (mgrDomain) {
        const bad = normItems.find((it) => it.category !== mgrDomain);
        if (bad) return res.status(400).json({ error: `managers can only create ${mgrDomain} leads` });
      }

      const created_by = req.user.user_id;

      await client.query('BEGIN');

      const leadSql = `
        INSERT INTO leads
          (store_id, name, contact_number, email, source, source_detail, created_by, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'New')
        RETURNING lead_id
      `;
      const { rows: leadRows } = await client.query(leadSql, [
        store_id,
        name,
        contact_number,
        email,
        source,
        source_detail,
        created_by,
      ]);
      const lead_id = leadRows[0].lead_id;

      const itemSql = `
        INSERT INTO lead_items
          (lead_id, item_description, category, brand, quantity)
        VALUES ($1,$2,$3,$4,$5)
      `;
      for (const it of normItems) {
        await client.query(itemSql, [
          lead_id,
          it.item_description,
          it.category,
          it.brand,
          it.quantity,
        ]);
      }

      await client.query(
        `
        INSERT INTO lead_status_history
          (lead_id, status, updated_by, notes)
        VALUES ($1,'New',$2,'Lead created')
      `,
        [lead_id, created_by]
      );

      await client.query('COMMIT');
      res.json({ lead_id });
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: e.message });
    } finally {
      client.release();
    }
  }
);

/* --------------------------- ASSIGN / TRANSFER --------------------------- */

retailRouter.post(
  '/leads/assign',
  authRequired,
  requireRole('laptop_manager', 'pc_manager'),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { lead_id, assigned_to, transfer_reason = null } = req.body || {};
      if (!lead_id || !assigned_to) {
        return res.status(400).json({ error: 'lead_id and assigned_to are required' });
      }

      const dom =
        req.user.role === 'laptop_manager'
          ? 'laptop'
          : req.user.role === 'pc_manager'
          ? 'pc_component'
          : null;
      if (!dom) return res.status(403).json({ error: 'Forbidden' });

      const domCheck = await pool.query(
        `SELECT EXISTS(
           SELECT 1
           FROM lead_items li
           WHERE li.lead_id = $1
             AND li.category <> $2
         ) AS has_other_domain`,
        [Number(lead_id), dom]
      );
      if (domCheck.rows[0]?.has_other_domain) {
        return res.status(403).json({ error: 'Lead has items outside your domain' });
      }

      const { rows: L } = await pool.query(
        `SELECT lead_id, assigned_to FROM leads WHERE lead_id = $1`,
        [Number(lead_id)]
      );
      if (!L.length) return res.status(404).json({ error: 'Lead not found' });

      const currentAssignee = L[0].assigned_to;
      const newAssignee = Number(assigned_to);
      const mgrId = req.user.user_id;
      const isTransfer = currentAssignee != null && currentAssignee !== newAssignee;

      await client.query('BEGIN');

      await client.query(
        `UPDATE leads
           SET assigned_to = $1,
               assigned_by = $2
         WHERE lead_id = $3`,
        [newAssignee, mgrId, Number(lead_id)]
      );

      const historyNote = isTransfer
        ? `Transferred from #${currentAssignee} to #${newAssignee}${
            transfer_reason ? ' — ' + transfer_reason : ''
          }`
        : `Assigned to #${newAssignee}`;

      await client.query(
        `INSERT INTO lead_status_history (lead_id, status, updated_by, notes)
         VALUES ($1, $2, $3, $4)`,
        [Number(lead_id), 'Assigned', mgrId, historyNote]
      );

      if (isTransfer) {
        await client.query(
          `INSERT INTO lead_transfers
             (lead_id, from_employee_id, to_employee_id, transfer_reason)
           VALUES ($1, $2, $3, $4)`,
          [Number(lead_id), Number(currentAssignee), newAssignee, transfer_reason || null]
        );
      }

      await client.query('COMMIT');
      res.json({ ok: true, transferred: Boolean(isTransfer) });
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: e.message });
    } finally {
      client.release();
    }
  }
);

/* ------------------------------- LIST LEADS ------------------------------ */

retailRouter.get('/leads', authRequired, async (req, res) => {
  try {
    const {
      assigned_to,
      created_by,
      assigned_by,
      domain,
      q,
      status,
      source,
      date_from,
      date_to,
      unassigned,
      limit = 50,
      offset = 0,
    } = req.query;

    const me = req.user.user_id;

    const rAssignedTo = assigned_to === 'me' ? me : assigned_to ? Number(assigned_to) : null;
    const rCreatedBy = created_by === 'me' ? me : created_by ? Number(created_by) : null;
    const rAssignedBy = assigned_by === 'me' ? me : assigned_by ? Number(assigned_by) : null;

    const role = req.user.role;
    const forcedDomain = role === 'laptop_manager' ? 'laptop' : role === 'pc_manager' ? 'pc_component' : null;
    const useDomain = domain || forcedDomain;

    const where = [];
    const params = [];
    const p = (val) => {
      params.push(val);
      return `$${params.length}`;
    };

    if (rAssignedTo != null) where.push(`assigned_to = ${p(rAssignedTo)}`);
    if (rCreatedBy != null) where.push(`created_by = ${p(rCreatedBy)}`);
    if (rAssignedBy != null) where.push(`assigned_by = ${p(rAssignedBy)}`);

    if (status) where.push(`status = ${p(status)}`);
    if (source) where.push(`COALESCE(source,'') ILIKE ${p(`%${source}%`)}`);

    if (q) {
      const v = `%${q}%`;
      where.push(
        `(name ILIKE ${p(v)} OR contact_number ILIKE ${p(v)} OR COALESCE(email,'') ILIKE ${p(v)})`
      );
    }

    if (date_from) where.push(`enquiry_date >= ${p(date_from)}`);
    if (date_to) where.push(`enquiry_date <= ${p(date_to)}`);

    if (unassigned) where.push(`assigned_to IS NULL`);

    if (useDomain) {
      where.push(`
        NOT EXISTS (
          SELECT 1 FROM lead_items li2
          WHERE li2.lead_id = leads.lead_id AND li2.category <> ${p(useDomain)}
        )
      `);
    }

    if (role === 'sales') {
      const a = p(me),
        b = p(me);
      where.push(`(assigned_to = ${a} OR created_by = ${b})`);
    }

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalSql = `SELECT COUNT(*)::int AS cnt FROM leads ${whereSQL};`;
    const { rows: trows } = await pool.query(totalSql, params.slice()); // use a copy
    const total = trows[0]?.cnt || 0;

    const dataSql = `
      SELECT lead_id, store_id, name, contact_number, email, source, enquiry_date,
             created_by, assigned_to, assigned_by, status, value_closed, closed_date
      FROM leads
      ${whereSQL}
      ORDER BY enquiry_date DESC, lead_id DESC
      LIMIT ${p(Number(limit))} OFFSET ${p(Number(offset))};
    `;
    const { rows } = await pool.query(dataSql, params);

    res.json({ total, data: rows });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/* ---------------------------- LEAD + HISTORY ---------------------------- */

retailRouter.get('/leads/:id', authRequired, async (req, res) => {
  try {
    const lead_id = Number(req.params.id);
    const { rows: L } = await pool.query('SELECT * FROM leads WHERE lead_id=$1', [lead_id]);
    if (!L.length) return res.status(404).json({ error: 'Lead not found' });
    const lead = L[0];

    const u = req.user;
    const isSalesOwn =
      u.role === 'sales' && (lead.assigned_to === u.user_id || lead.created_by === u.user_id);

    let domainOK = false;
    if (u.role === 'laptop_manager' || u.role === 'pc_manager') {
      const dom = u.role === 'laptop_manager' ? 'laptop' : 'pc_component';
      const q = await pool.query('SELECT DISTINCT category FROM lead_items WHERE lead_id=$1', [
        lead_id,
      ]);
      const cats = q.rows.map((r) => r.category);
      domainOK = cats.length === 0 || cats.every((c) => c === dom);
    }

    if (!(isSalesOwn || domainOK)) return res.status(403).json({ error: 'Forbidden' });

    const { rows: items } = await pool.query(
      'SELECT * FROM lead_items WHERE lead_id=$1 ORDER BY lead_item_id ASC',
      [lead_id]
    );

    const { rows: history } = await pool.query(
      `SELECT h.status_id, h.status, h.update_timestamp, h.notes,
              e.name AS updated_by_name, e.employee_id AS updated_by
       FROM lead_status_history h
       LEFT JOIN employees e ON e.employee_id = h.updated_by
       WHERE h.lead_id=$1
       ORDER BY h.update_timestamp DESC`,
      [lead_id]
    );

    res.json({ lead, items, history });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/* --------------------------- ANALYTICS: STATUS -------------------------- */

retailRouter.get('/analytics/status', authRequired, async (req, res) => {
  try {
    const scope = req.query.scope || 'me';
    const me = req.user.user_id;
    const parts = [];
    const params = [];

    if (scope === 'me') {
      params.push(me);
      parts.push(`assigned_to = $${params.length}`);
    } else if (scope === 'domain') {
      const dom = getManagerDomain(req.user.role);
      if (!dom) return res.status(403).json({ error: 'Forbidden' });
      params.push(dom);
      parts.push(
        `NOT EXISTS (SELECT 1 FROM lead_items li2 WHERE li2.lead_id = leads.lead_id AND li2.category <> $${params.length})`
      );
    }

    const where = parts.length ? `WHERE ${parts.join(' AND ')}` : '';
    const sql = `SELECT status, COUNT(*)::int AS count FROM leads ${where} GROUP BY status ORDER BY status;`;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/* ---------------------- ANALYTICS: TEAM WORKLOAD ----------------------- */

retailRouter.get(
  '/analytics/team-workload',
  authRequired,
  requireRole('laptop_manager', 'pc_manager'),
  async (req, res) => {
    try {
      const managerId = req.user.user_id;
      const dom = getManagerDomain(req.user.role);

      const params = [managerId, dom];
      const sql = `
        SELECT
          e.employee_id,
          COALESCE(e.name, e.email) AS name,
          COUNT(*)::int AS assigned_count,
          SUM( (l.status NOT IN ('Closed Won','Closed Lost'))::int )::int AS open_count,
          SUM( (l.status = 'Closed Won')::int )::int AS won_count,
          COALESCE(SUM(CASE WHEN l.status = 'Closed Won' THEN l.value_closed ELSE 0 END), 0) AS won_value
        FROM leads l
        LEFT JOIN employees e ON e.employee_id = l.assigned_to
        WHERE l.assigned_by = $1
          AND l.assigned_to IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM lead_items li2
            WHERE li2.lead_id = l.lead_id AND li2.category <> $2
          )
        GROUP BY e.employee_id, COALESCE(e.name, e.email)
        ORDER BY name NULLS LAST;
      `;
      const { rows } = await pool.query(sql, params);
      res.json(rows);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
);

/* ----------------------- ANALYTICS: PERFORMANCE ------------------------ */

retailRouter.get('/analytics/performance', authRequired, async (req, res) => {
  try {
    const scope = req.query.scope || 'me';
    const period = (req.query.period || 'month').toLowerCase(); // month | quarter
    const me = req.user.user_id;
    if (scope !== 'me') return res.status(400).json({ error: 'scope must be "me"' });

    const frame = period === 'quarter' ? 'quarter' : 'month';
    const params = [me];
    const where = `assigned_to = $1 AND closed_date >= date_trunc('${frame}', CURRENT_DATE)`;

    const wonSql = `SELECT COUNT(*)::int AS c, COALESCE(SUM(value_closed),0) AS v FROM leads WHERE status='Closed Won' AND ${where};`;
    const lostSql = `SELECT COUNT(*)::int AS c FROM leads WHERE status='Closed Lost' AND ${where};`;
    const actSql = `SELECT COUNT(*)::int AS c FROM lead_status_history WHERE updated_by = $1 AND update_timestamp >= date_trunc('${frame}', CURRENT_DATE);`;

    const [{ rows: won }, { rows: lost }, { rows: act }] = await Promise.all([
      pool.query(wonSql, params),
      pool.query(lostSql, params),
      pool.query(actSql, params),
    ]);

    res.json({
      period,
      won_count: won[0].c,
      won_value: Number(won[0].v || 0),
      lost_count: lost[0].c,
      activity_count: act[0].c,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/* --------------------------- REMINDERS (RETAIL) ------------------------- */

retailRouter.get('/reminders/retail', authRequired, async (req, res) => {
  try {
    const scope = req.query.scope || 'me';
    const me = req.user.user_id;

    const baseWhere = [];
    const params = [];

    baseWhere.push(`l.status NOT IN ('Closed Won','Closed Lost')`);

    if (scope === 'me') {
      params.push(me);
      baseWhere.push(`l.assigned_to = $${params.length}`);
    } else if (scope === 'domain') {
      const dom = getManagerDomain(req.user.role);
      if (!dom) return res.status(403).json({ error: 'Forbidden' });
      params.push(dom);
      baseWhere.push(`NOT EXISTS (
        SELECT 1 FROM lead_items li2 WHERE li2.lead_id = l.lead_id AND li2.category <> $${params.length}
      )`);
    }

    const whereSQL = baseWhere.length ? `WHERE ${baseWhere.join(' AND ')}` : '';

    const sql = `
      WITH last_update AS (
        SELECT lead_id, MAX(update_timestamp) AS last_ts
        FROM lead_status_history
        GROUP BY lead_id
      )
      SELECT l.lead_id, l.name, l.assigned_to, COALESCE(lu.last_ts, l.enquiry_date::timestamptz) AS last_activity
      FROM leads l
      LEFT JOIN last_update lu ON lu.lead_id = l.lead_id
      ${whereSQL}
      AND COALESCE(lu.last_ts, l.enquiry_date::timestamptz) < NOW() - INTERVAL '3 days'
      ORDER BY last_activity ASC
      LIMIT 100;
    `;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/* -------------------- UPDATE STATUS (FIXED FOR ENUMS) ------------------- */

retailRouter.post('/leads/status', authRequired, async (req, res) => {
  try {
    const { lead_id, status, notes, value_closed } = req.body || {};
    if (!lead_id || !status) {
      return res.status(400).json({ error: 'lead_id and status are required' });
    }

    // fetch lead (visibility checks)
    const { rows: L } = await pool.query(
      'SELECT lead_id, assigned_to FROM leads WHERE lead_id = $1',
      [Number(lead_id)]
    );
    if (!L.length) return res.status(404).json({ error: 'Lead not found' });

    const lead = L[0];
    const u = req.user;

    if (u.role === 'sales' && lead.assigned_to !== u.user_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (u.role === 'laptop_manager' || u.role === 'pc_manager') {
      const dom = u.role === 'laptop_manager' ? 'laptop' : 'pc_component';
      const chk = await pool.query(
        `SELECT EXISTS(
           SELECT 1 FROM lead_items
           WHERE lead_id = $1 AND category <> $2
         ) AS other_domain`,
        [Number(lead_id), dom]
      );
      if (chk.rows[0]?.other_domain) {
        return res.status(403).json({ error: 'Lead has items outside your domain' });
      }
    }

    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');

      const isClosed = status === 'Closed Won' || status === 'Closed Lost';
      const isClosedWon = status === 'Closed Won';
      const vClosed = value_closed != null ? Number(value_closed) : null;

      if (isClosed) {
        await tx.query(
          `UPDATE leads
             SET status = $1,
                 closed_date = CURRENT_DATE,
                 value_closed = CASE WHEN $3 THEN COALESCE($2, value_closed)
                                     ELSE value_closed
                                END
           WHERE lead_id = $4`,
          [status, vClosed, isClosedWon, Number(lead_id)]
        );
      } else {
        await tx.query(
          `UPDATE leads
             SET status = $1
           WHERE lead_id = $2`,
          [status, Number(lead_id)]
        );
      }

      await tx.query(
        `INSERT INTO lead_status_history (lead_id, status, updated_by, notes)
         VALUES ($1, $2, $3, $4)`,
        [Number(lead_id), status, u.user_id, notes ?? null]
      );

      await tx.query('COMMIT');
      res.json({ ok: true });
    } catch (err) {
      await tx.query('ROLLBACK');
      console.error('status update error:', err);
      res.status(400).json({ error: err.message || 'Failed to update status' });
    } finally {
      tx.release();
    }
  } catch (e) {
    res.status(400).json({ error: e.message || 'Bad request' });
  }
});

/* ------------------------------- TRANSFERS ------------------------------ */

retailRouter.get(
  '/leads/:id/transfers',
  authRequired,
  requireRole('laptop_manager', 'pc_manager', 'sales'),
  async (req, res) => {
    try {
      const leadId = Number(req.params.id);
      const { rows } = await pool.query(
        `SELECT t.id, t.transfer_date, t.transfer_reason,
                fe.employee_id AS from_id, COALESCE(fe.name, fe.email) AS from_name,
                te.employee_id AS to_id,   COALESCE(te.name, te.email) AS to_name
         FROM lead_transfers t
         LEFT JOIN employees fe ON fe.employee_id = t.from_employee_id
         LEFT JOIN employees te ON te.employee_id = t.to_employee_id
         WHERE t.lead_id = $1
         ORDER BY t.transfer_date DESC`,
        [leadId]
      );
      res.json(rows);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
);

module.exports = { retailRouter };

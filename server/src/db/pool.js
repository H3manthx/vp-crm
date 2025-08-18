const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 15,
  idleTimeoutMillis: 30000
});

module.exports = { pool };
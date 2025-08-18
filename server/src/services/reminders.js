const cron = require('node-cron');
const { pool } = require('../db/pool');

// Runs every day at 9:30 AM IST (Asia/Kolkata = UTC+5:30)
// Cron string uses server local time; adjust if needed.
function startReminderJobs(){

  // Retail: every 3 days for untouched open leads
  cron.schedule('30 9 * * *', async () => {
    try{
      await pool.query(`
        INSERT INTO retail_lead_reminders (lead_id, remind_at, reason)
        SELECT l.lead_id, NOW(), 'untouched_3_days'
        FROM leads l
        WHERE l.status NOT ILIKE 'Closed%' AND l.status NOT ILIKE 'Lost%'
          AND l.lead_id NOT IN (
            SELECT lead_id FROM lead_status_history
            WHERE update_timestamp >= NOW() - INTERVAL '3 days'
          )
          AND l.lead_id NOT IN (
            SELECT lead_id FROM retail_lead_reminders
            WHERE done = FALSE AND remind_at::date = CURRENT_DATE
          )
      `);
      // Optionally send emails/notifications later
    }catch(e){
      console.error('Retail reminder job error:', e.message);
    }
  });

  // Corporate: 1-week follow-up after deal closed
  cron.schedule('35 9 * * *', async () => {
    try{
      await pool.query(`
        INSERT INTO corporate_lead_reminders (corporate_lead_id, remind_at, reminder_type, notes)
        SELECT cl.corporate_lead_id, NOW(), 'follow_up', '1-week post-closure follow-up'
        FROM corporate_leads cl
        WHERE cl.closed_date IS NOT NULL
          AND cl.closed_date = CURRENT_DATE - INTERVAL '7 days'
          AND NOT EXISTS (
            SELECT 1 FROM corporate_lead_reminders r
            WHERE r.corporate_lead_id = cl.corporate_lead_id
              AND r.reminder_type = 'follow_up'
              AND r.remind_at::date = CURRENT_DATE
          )
      `);
    }catch(e){
      console.error('Corporate reminder job error:', e.message);
    }
  });
}

module.exports = { startReminderJobs };
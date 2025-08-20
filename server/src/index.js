// server/src/index.js  (ESM)
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import { buildCors } from './cors.js';

import { authRouter } from './routes/auth.js';
import { retailRouter } from './routes/retail.js';
import { corporateRouter } from './routes/corporate.js';
import { employeesRouter } from './routes/employees.js';
import { remindersRouter } from './routes/reminders.js';
import { storesRouter } from './routes/stores.js';
import { corporateQuotesRouter } from './routes/corporateQuotes.js';
import { corporateProposalsRouter } from './routes/corporateProposals.js';
import { startReminderJobs } from './services/reminders.js';

// If export.js default-exports the router:
import exportRouter from './routes/export.js'; // else:  import { exportRouter } from './routes/export.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);

// ----- CORS first -----
const corsMw = buildCors();
app.use(corsMw);
app.options('*', corsMw);

// Common middleware
app.use(express.json());
app.use(helmet());
app.use(morgan('dev'));

// Health
app.get('/', (_req, res) => res.status(200).send('ok'));
app.get('/health', (_req, res) => res.json({ ok: true }));

// Static
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')));

// Helper to find the bad router quickly
function mountOrDie(prefix, name, router) {
  try {
    console.log(`[BOOT] Mounting ${name} at ${prefix}`);
    app.use(prefix, router);
    console.log(`[BOOT] Mounted ${name}`);
  } catch (e) {
    console.error(`[BOOT][FATAL] Failed mounting ${name} at ${prefix}`);
    console.error(e?.stack || e);
    // Exit so Cloud Run logs show this clearly
    process.exit(1);
  }
}

// Mount routers (the log before the crash = culprit next)
mountOrDie('/api/auth', 'authRouter', authRouter);
mountOrDie('/api/retail', 'retailRouter', retailRouter);
mountOrDie('/api/corporate', 'corporateRouter', corporateRouter);
mountOrDie('/api/employees', 'employeesRouter', employeesRouter);
mountOrDie('/api/reminders', 'remindersRouter', remindersRouter);
mountOrDie('/api/stores', 'storesRouter', storesRouter);
mountOrDie('/api/corporate/leads/quotes', 'corporateQuotesRouter', corporateQuotesRouter);
mountOrDie('/api/corporate/leads/proposals', 'corporateProposalsRouter', corporateProposalsRouter);
mountOrDie('/api', 'exportRouter', exportRouter);

const port = Number(process.env.PORT) || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log(`API listening on ${port}`);
  startReminderJobs();
});

process.on('unhandledRejection', err => {
  console.error('UNHANDLED REJECTION', err);
  process.exit(1);
});
process.on('uncaughtException', err => {
  console.error('UNCAUGHT EXCEPTION', err);
  process.exit(1);
});

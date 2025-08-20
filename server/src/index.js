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

// If your export.js default-exports the router:
import exportRouter from './routes/export.js';
// If it named-exports instead, use:  import { exportRouter } from './routes/export.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Cloud Run sits behind a proxy; ensure correct protocol/origin handling
app.set('trust proxy', 1);

// ----- CORS must be FIRST and must handle OPTIONS for every path -----
const corsMw = buildCors();
app.use(corsMw);
app.options('*', corsMw);

// Usual middleware
app.use(express.json());
app.use(helmet());
app.use(morgan('dev'));

// Simple roots for health checks
app.get('/', (_req, res) => res.status(200).send('ok'));
app.get('/health', (_req, res) => res.json({ ok: true }));

// Static uploads
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')));

// API routers
app.use('/api/auth', authRouter);
app.use('/api/retail', retailRouter);
app.use('/api/corporate', corporateRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/stores', storesRouter);
app.use('/api/corporate/leads/quotes', corporateQuotesRouter);
app.use('/api/corporate/leads/proposals', corporateProposalsRouter);
app.use('/api', exportRouter);

// ----- Boot -----
const port = Number(process.env.PORT) || 8080;
// Bind to 0.0.0.0 so Cloud Run can reach it
app.listen(port, '0.0.0.0', () => {
  console.log(`API listening on ${port}`);
  startReminderJobs();
});

// Surface hard failures in logs
process.on('unhandledRejection', err => {
  console.error('UNHANDLED REJECTION', err);
  process.exit(1);
});
process.on('uncaughtException', err => {
  console.error('UNCAUGHT EXCEPTION', err);
  process.exit(1);
});

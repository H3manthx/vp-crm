// server/src/index.js  (ESM)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import { authRouter } from './routes/auth.js';
import { retailRouter } from './routes/retail.js';
import { corporateRouter } from './routes/corporate.js';
import { employeesRouter } from './routes/employees.js';
import { remindersRouter } from './routes/reminders.js';
import { storesRouter } from './routes/stores.js';
import { corporateQuotesRouter } from './routes/corporateQuotes.js';
import { corporateProposalsRouter } from './routes/corporateProposals.js';
import { startReminderJobs } from './services/reminders.js';

// If your export.js does `export default router`, keep default import:
import exportRouter from './routes/export.js';
// If instead it does `export const exportRouter = router;`, use:
// import { exportRouter } from './routes/export.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true }));

// static uploads
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')));

// Routers
app.use('/api/auth', authRouter);
app.use('/api/retail', retailRouter);
app.use('/api/corporate', corporateRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/stores', storesRouter);
app.use('/api/corporate/leads/quotes', corporateQuotesRouter);
app.use('/api/corporate/leads/proposals', corporateProposalsRouter);
app.use('/api', exportRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
  startReminderJobs();
});

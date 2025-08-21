// server/src/index.js  (ESM)
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import { buildCors } from './cors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);

// ----- CORS first -----
const corsMw = buildCors();
app.use(corsMw);
// Express 5: don't use "*" — use a real pattern or omit this line

// Common middleware
app.use(express.json());
app.use(helmet());
app.use(morgan('dev'));

// Health
app.get('/', (_req, res) => res.status(200).send('ok'));
app.get('/health', (_req, res) => res.json({ ok: true }));

// Static
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')));

// Helpers
async function importOrDie(spec, name) {
  try {
    console.log(`[BOOT] Importing ${name} from ${spec}`);
    const mod = await import(spec);
    console.log(`[BOOT] Imported ${name}`);
    return mod;
  } catch (e) {
    console.error(`[BOOT][FATAL] Import failed for ${name} (${spec})`);
    console.error(e?.stack || e);
    process.exit(1);
  }
}

// Unwrap ESM/CJS consistently: prefer a router function
function pickRouter(mod, named) {
  // CJS via ESM import => { default: { named: router } }
  if (mod?.default && typeof mod.default === 'object' && mod.default[named]) {
    return mod.default[named];
  }
  // CJS default is directly the router (rare)
  if (mod?.default && typeof mod.default === 'function') {
    return mod.default;
  }
  // Proper ESM named export
  if (mod?.[named]) return mod[named];
  throw new Error(`Router "${named}" not found in imported module`);
}

function mountOrDie(prefix, name, router) {
  try {
    if (typeof router !== 'function') {
      throw new TypeError(`Expected middleware function for ${name}, got ${typeof router}`);
    }
    console.log(`[BOOT] Mounting ${name} at ${prefix}`);
    app.use(prefix, router);
    console.log(`[BOOT] Mounted ${name}`);
  } catch (e) {
    console.error(`[BOOT][FATAL] Failed mounting ${name} at ${prefix}`);
    console.error(e?.stack || e);
    process.exit(1);
  }
}

// ---- Import & mount routers ----
const authMod = await importOrDie('./routes/auth.js', 'authRouter');
mountOrDie('/api/auth', 'authRouter', pickRouter(authMod, 'authRouter'));

const retailMod = await importOrDie('./routes/retail.js', 'retailRouter');
mountOrDie('/api/retail', 'retailRouter', pickRouter(retailMod, 'retailRouter'));

const corporateMod = await importOrDie('./routes/corporate.js', 'corporateRouter');
mountOrDie('/api/corporate', 'corporateRouter', pickRouter(corporateMod, 'corporateRouter'));

const employeesMod = await importOrDie('./routes/employees.js', 'employeesRouter');
mountOrDie('/api/employees', 'employeesRouter', pickRouter(employeesMod, 'employeesRouter'));

const remindersMod = await importOrDie('./routes/reminders.js', 'remindersRouter');
mountOrDie('/api/reminders', 'remindersRouter', pickRouter(remindersMod, 'remindersRouter'));

const storesMod = await importOrDie('./routes/stores.js', 'storesRouter');
mountOrDie('/api/stores', 'storesRouter', pickRouter(storesMod, 'storesRouter'));

const quotesMod = await importOrDie('./routes/corporateQuotes.js', 'corporateQuotesRouter');
mountOrDie('/api/corporate/leads/quotes', 'corporateQuotesRouter', pickRouter(quotesMod, 'corporateQuotesRouter'));

const proposalsMod = await importOrDie('./routes/corporateProposals.js', 'corporateProposalsRouter');
mountOrDie('/api/corporate/leads/proposals', 'corporateProposalsRouter', pickRouter(proposalsMod, 'corporateProposalsRouter'));

const exportMod = await importOrDie('./routes/export.js', 'exportRouter');
mountOrDie('/api', 'exportRouter', pickRouter(exportMod, 'exportRouter'));

// ----- Boot -----
const port = Number(process.env.PORT) || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log(`API listening on ${port}`);
  import('./services/reminders.js')
    .then(({ startReminderJobs }) => startReminderJobs?.())
    .catch(err => console.error('[BOOT] Failed to start reminder jobs', err));
});

process.on('unhandledRejection', err => { console.error('UNHANDLED REJECTION', err); process.exit(1); });
process.on('uncaughtException',  err => { console.error('UNCAUGHT EXCEPTION', err);  process.exit(1); });

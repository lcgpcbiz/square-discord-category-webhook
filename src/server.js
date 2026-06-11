import express from 'express';
import { config } from './config.js';
import { verifySquareSignature } from './verifySquare.js';
import { syncChangedCatalogObjects } from './sync.js';
import { postDiscord } from './discord.js';
import { seedCurrentCatalogState } from './seedCatalog.js';

const app = express();
let syncInProgress = false;
let syncAgainAfterCurrent = false;

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'square-discord-category-webhook' });
});

function requireAdmin(req, res, next) {
  if (!config.adminToken) return res.status(404).send('Not found');
  const auth = req.header('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== config.adminToken) return res.status(401).send('Unauthorized');
  next();
}


app.post('/square-webhook', express.raw({ type: '*/*' }), async (req, res) => {
  const signature = req.header('x-square-hmacsha256-signature');
  const valid = verifySquareSignature(req.body, signature);

  if (!valid) {
    console.warn('Rejected request with invalid Square signature');
    return res.status(403).send('Invalid signature');
  }

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).send('Invalid JSON');
  }

  if (event.type !== 'catalog.version.updated') {
    return res.status(200).send('Ignored event type');
  }

  // Square wants a fast 2xx. Process after acknowledging.
  res.status(200).send('Accepted');

  const updatedAt = event.data?.object?.catalog_version?.updated_at || event.created_at || new Date().toISOString();
  queueSync(updatedAt);
});

app.post('/admin/test-discord', express.json(), requireAdmin, async (_req, res) => {
  await postDiscord({ content: 'Square → Discord test message is working.' });
  res.json({ ok: true });
});

app.post('/admin/seed', express.json(), requireAdmin, async (_req, res) => {
  const result = await seedCurrentCatalogState();
  res.json({ ok: true, ...result });
});

function queueSync(updatedAt) {
  if (syncInProgress) {
    syncAgainAfterCurrent = updatedAt;
    return;
  }

  syncInProgress = true;
  setTimeout(async () => {
    try {
      const result = await syncChangedCatalogObjects(updatedAt);
      console.log('Sync complete:', result);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      syncInProgress = false;
      if (syncAgainAfterCurrent) {
        const next = syncAgainAfterCurrent;
        syncAgainAfterCurrent = false;
        queueSync(next);
      }
    }
  }, 1500);
}

app.listen(config.port, () => {
  console.log(`Listening on port ${config.port}`);
  console.log(`Square webhook endpoint: ${config.publicWebhookUrl}`);
});

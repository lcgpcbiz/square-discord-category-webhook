import express from 'express';
import { config } from './config.js';
import { verifySquareSignature } from './verifySquare.js';
import { syncChangedCatalogObjects, syncInventoryCountEvent } from './sync.js';
import { postDiscord } from './discord.js';
import { seedCurrentCatalogState } from './seedCatalog.js';

const app = express();
let catalogSyncInProgress = false;
let catalogSyncAgainAfterCurrent = false;
let inventorySyncChain = Promise.resolve();

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

  // Square wants a fast 2xx. Process after acknowledging.
  res.status(200).send('Accepted');

  if (event.type === 'catalog.version.updated') {
    const updatedAt = event.data?.object?.catalog_version?.updated_at || event.created_at || new Date().toISOString();
    queueCatalogSync(updatedAt);
    return;
  }

  if (event.type === 'inventory.count.updated') {
    queueInventorySync(event);
    return;
  }

  console.log(`Ignored Square event type: ${event.type}`);
});

app.post('/admin/test-discord', express.json(), requireAdmin, async (_req, res) => {
  await postDiscord({ content: 'Square → Discord test message is working.' });
  res.json({ ok: true });
});

app.post('/admin/seed', express.json(), requireAdmin, async (_req, res) => {
  const result = await seedCurrentCatalogState();
  res.json({ ok: true, ...result });
});

function queueCatalogSync(updatedAt) {
  if (catalogSyncInProgress) {
    catalogSyncAgainAfterCurrent = updatedAt;
    return;
  }

  catalogSyncInProgress = true;
  setTimeout(async () => {
    try {
      const result = await syncChangedCatalogObjects(updatedAt);
      console.log('Catalog sync complete:', result);
    } catch (error) {
      console.error('Catalog sync failed:', error);
    } finally {
      catalogSyncInProgress = false;
      if (catalogSyncAgainAfterCurrent) {
        const next = catalogSyncAgainAfterCurrent;
        catalogSyncAgainAfterCurrent = false;
        queueCatalogSync(next);
      }
    }
  }, 1500);
}

function queueInventorySync(event) {
  // Inventory updates for the same item/variation can arrive in bursts.
  // Serialize them so two webhooks cannot load the same old state and overwrite each other.
  inventorySyncChain = inventorySyncChain
    .then(() => new Promise(resolve => setTimeout(resolve, 250)))
    .then(async () => {
      const result = await syncInventoryCountEvent(event);
      console.log('Inventory sync complete:', result);
    })
    .catch(error => {
      console.error('Inventory sync failed:', error);
    });
}

app.listen(config.port, () => {
  console.log(`Listening on port ${config.port}`);
  console.log(`Square webhook endpoint: ${config.publicWebhookUrl}`);
  console.log('Listening for Square events: catalog.version.updated, inventory.count.updated');
});

import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';

const DATA_DIR = path.resolve(config.stateDir);
const STATE_FILE = path.join(DATA_DIR, 'state.json');

export async function loadState() {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { lastSyncAt: null, lastInventoryEventAt: null, items: {}, processedEvents: {} };
  }
}

export async function saveState(state) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${STATE_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2));
  await fs.rename(tmp, STATE_FILE);
}

export function subtractSeconds(isoString, seconds) {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() - seconds * 1000).toISOString();
}

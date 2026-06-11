import { config } from './config.js';
import { getChangedItemCandidates, resolveCategoryId } from './square.js';
import { loadState, saveState, subtractSeconds } from './state.js';
import { itemIsActive, itemIsInCategory, itemSnapshot, snapshotChanged } from './catalogLogic.js';
import { postDiscordItemNotice } from './discord.js';

export async function syncChangedCatalogObjects(webhookUpdatedAt = null) {
  const state = await loadState();
  const categoryId = await resolveCategoryId();

  const beginTime = subtractSeconds(state.lastSyncAt, config.syncLookbackSeconds);
  const candidates = await getChangedItemCandidates(beginTime);

  let announced = 0;
  let checked = 0;

  for (const item of candidates) {
    checked++;

    if (config.onlyAnnounceActiveItems && !itemIsActive(item)) {
      state.items[item.id] = itemSnapshot(item, false);
      continue;
    }

    const inCategory = itemIsInCategory(item, categoryId);
    const previous = state.items[item.id] || null;
    const next = itemSnapshot(item, inCategory);

    if (!inCategory) {
      state.items[item.id] = next;
      continue;
    }

    const wasInCategory = previous?.inWatchedCategory === true;
    const changed = snapshotChanged(previous, next);

    let action = null;
    if (!wasInCategory) action = 'added';
    else if (changed) action = 'updated';

    const shouldAnnounce =
      (action === 'added' && config.announceAdds) ||
      (action === 'updated' && config.announceUpdates);

    if (shouldAnnounce) {
      await postDiscordItemNotice(item, action);
      announced++;
    }

    state.items[item.id] = next;
  }

  state.lastSyncAt = webhookUpdatedAt || new Date().toISOString();
  await saveState(state);

  return { checked, announced, categoryId, lastSyncAt: state.lastSyncAt };
}

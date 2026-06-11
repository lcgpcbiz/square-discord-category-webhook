import { config } from './config.js';
import { cheapestPriceText, itemUrl, skuText, variationName } from './catalogLogic.js';
import { getFirstItemImageUrl } from './square.js';

function discordColor(action) {
  if (action === 'added') return 0x2ecc71;       // green
  if (action === 'sold_out') return 0xe74c3c;    // red
  if (action === 'quantity') return 0x3498db;    // blue
  return 0xf1c40f;                               // yellow
}

function actionTitle(action, categoryName) {
  if (action === 'added') return `New item added in ${categoryName}`;
  if (action === 'sold_out') return `🔴 SOLD OUT in ${categoryName}`;
  if (action === 'quantity') return `Quantity updated in ${categoryName}`;
  return `Item updated in ${categoryName}`;
}

function actionContent(action, categoryName, name, roleMention) {
  if (action === 'added') return `${roleMention}New item added in **${categoryName}**: **${name}**`;
  if (action === 'sold_out') return `${roleMention}🔴 **SOLD OUT** in **${categoryName}**: **${name}**`;
  if (action === 'quantity') return `${roleMention}Inventory updated in **${categoryName}**: **${name}**`;
  return `${roleMention}Item updated in **${categoryName}**: **${name}**`;
}

export async function postDiscordItemNotice(item, action, options = {}) {
  const name = item.item_data?.name || '(Unnamed Square item)';
  const variation = options.variation || null;
  const url = itemUrl(item, variation);
  const imageUrl = config.showItemImage ? await getFirstItemImageUrl(item) : null;
  const roleMention = config.roleMentionId ? `<@&${config.roleMentionId}> ` : '';

  const fields = [
    { name: 'Category', value: config.categoryName, inline: true },
    { name: 'Starting price', value: cheapestPriceText(item), inline: true },
    { name: 'SKU', value: skuText(item), inline: false }
  ];

  if (options.quantityText) {
    fields.unshift({ name: 'Quantity', value: options.quantityText, inline: true });
  }

  if (variation) {
    const vName = variationName(item, variation.id) || variation.item_variation_data?.name || 'Default';
    fields.unshift({ name: 'Variation', value: vName, inline: true });
  }

  const embed = {
    title: actionTitle(action, config.categoryName),
    url: url || undefined,
    description: url ? `[View item](${url})` : name,
    color: discordColor(action),
    fields,
    footer: { text: 'Lucky Cat Square Store' },
    timestamp: new Date().toISOString()
  };

  if (imageUrl) {
    embed.image = { url: imageUrl };
  }

  const payload = {
    content: actionContent(action, config.categoryName, name, roleMention),
    allowed_mentions: config.roleMentionId ? { roles: [config.roleMentionId] } : { parse: [] },
    embeds: [embed]
  };

  await postDiscord(payload);
}

export async function postDiscordInventoryNotice(item, variation, previousTotal, nextTotal) {
  const action = nextTotal <= 0 ? 'sold_out' : 'quantity';
  const quantityText = previousTotal === null || previousTotal === undefined
    ? `Now ${nextTotal}`
    : `${previousTotal} → ${nextTotal}`;

  await postDiscordItemNotice(item, action, {
    variation,
    quantityText
  });
}

export async function postDiscord(payload) {
  const response = await fetch(config.discordWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (response.status === 429) {
    const data = await response.json().catch(() => ({}));
    const waitMs = Math.ceil((data.retry_after || 1) * 1000);
    await new Promise(resolve => setTimeout(resolve, waitMs));
    return await postDiscord(payload);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord webhook failed: ${response.status} ${response.statusText} ${text}`);
  }
}

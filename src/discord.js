import { config } from './config.js';
import { cheapestPriceText, itemUrl, skuText } from './catalogLogic.js';

function discordColor(action) {
  return action === 'added' ? 0x2ecc71 : 0xf1c40f;
}

export async function postDiscordItemNotice(item, action) {
  const name = item.item_data?.name || '(Unnamed Square item)';
  const url = itemUrl(item);
  const roleMention = config.roleMentionId ? `<@&${config.roleMentionId}> ` : '';

  const payload = {
    content: `${roleMention}${action === 'added' ? 'New item added' : 'Item updated'} in **${config.categoryName}**`,
    allowed_mentions: config.roleMentionId ? { roles: [config.roleMentionId] } : { parse: [] },
    embeds: [
      {
        title: name,
        url: url || undefined,
        color: discordColor(action),
        fields: [
          { name: 'Category', value: config.categoryName, inline: true },
          { name: 'Starting price', value: cheapestPriceText(item), inline: true },
          { name: 'SKU', value: skuText(item), inline: false }
        ],
        footer: { text: 'Lucky Cat Square Store' },
        timestamp: new Date().toISOString()
      }
    ]
  };

  await postDiscord(payload);
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

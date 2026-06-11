# Square Catalog + Inventory → Discord Webhook

This app watches a Square catalog category, such as `TCG Singles`, and posts to Discord when:

- a new item is added to the watched category
- inventory quantity changes for an item variation in that category
- inventory drops to 0, which posts as a red `SOLD OUT` embed

Existing catalog edits such as price changes are ignored by default.

## Item/category link behavior

For Lucky Cat singles, the app now prefers category links instead of unreliable item/search links. Each item should be assigned to `TCG Singles` plus one card-game category, such as `Pokemon Singles` or `MTG Singles`. The bot detects that second category and links the Discord embed to that game's Square Online category page.

The category IDs are built into the app:

- `MTG Singles`: `5UWL64AV6MEABQ6RCR6QIB73`
- `Pokemon Singles`: `WUMBDVIADGF5EUH457RAUOIM`
- `One Piece Singles`: `YVVUAAUSMJEUX6JD6QJWCWLS`
- `Riftbound Singles`: `YQP7QDXR5TYQG6FNOEK7Q5EU`
- `Lorcana Singles`: `IVTG2K5BVS6YTYYGFE5L5SEI`
- `Gundam Singles`: `VZBIESUN4MY5CA4R2QZK7LNH`

Default category URL pattern:

```env
STORE_CATEGORY_URL_TEMPLATE=https://lctcg.com/s/shop?category_ids={category_id}
```

If Square Online uses a different public URL for your category pages, change `STORE_CATEGORY_URL_TEMPLATE` in Render or provide exact category URLs with `SUBCATEGORY_LINKS_JSON`.

## Required Square webhook events

Subscribe the same Square webhook endpoint to both events:

- `catalog.version.updated`
- `inventory.count.updated`

The webhook URL should be:

```text
https://YOUR-RENDER-SERVICE.onrender.com/square-webhook
```

That exact URL must also be saved as `PUBLIC_WEBHOOK_URL` in Render.

## Required Square API access

The app needs:

- Catalog/item read access for catalog changes
- Inventory read access for quantity updates

## Required Render environment variables

Do not commit these secrets to GitHub. Set them in Render:

```env
PUBLIC_WEBHOOK_URL=https://YOUR-RENDER-SERVICE.onrender.com/square-webhook
SQUARE_ENVIRONMENT=production
SQUARE_ACCESS_TOKEN=YOUR_SQUARE_PRODUCTION_ACCESS_TOKEN
SQUARE_SIGNATURE_KEY=YOUR_SQUARE_WEBHOOK_SIGNATURE_KEY
SQUARE_API_VERSION=2026-05-20
CATEGORY_NAME=TCG Singles
CATEGORY_ID=
DISCORD_WEBHOOK_URL=YOUR_DISCORD_WEBHOOK_URL
ADMIN_TOKEN=MAKE_THIS_LONG_AND_RANDOM
STATE_DIR=/var/data
```

Recommended behavior settings:

```env
ANNOUNCE_ADDS=true
ANNOUNCE_CATALOG_UPDATES=false
ANNOUNCE_UPDATES=false
ANNOUNCE_QUANTITY_UPDATES=true
ANNOUNCE_SOLD_OUT=true
INVENTORY_STATE=IN_STOCK
SHOW_ITEM_IMAGE=true
LINK_MODE=category
STORE_BASE_URL=https://lctcg.com
STORE_CATEGORY_URL_TEMPLATE=https://lctcg.com/s/shop?category_ids={category_id}
```

Optional link settings:

```env
# Recommended Lucky Cat behavior: category links by card game.
LINK_MODE=category
STORE_BASE_URL=https://lctcg.com
STORE_CATEGORY_URL_TEMPLATE=https://lctcg.com/s/shop?category_ids={category_id}

# If you copy exact public category URLs from your Square site navigation, you can override the built-in map.
SUBCATEGORY_LINKS_JSON=[{"id":"WUMBDVIADGF5EUH457RAUOIM","name":"Pokemon Singles","url":"https://lctcg.com/your-pokemon-category-url"}]

# Use Square's direct item URL first if Square provides one, otherwise category.
LINK_MODE=direct_then_category

# Never include links.
LINK_MODE=none
```

## Setup

Install dependencies:

```bash
npm install
```

Test Discord:

```bash
npm run test-discord
```

Seed current catalog and inventory state so existing items and existing quantities do not all post as new:

```bash
npm run seed
```

Start the server:

```bash
npm start
```

## Render deployment

This app stores sync state in `state.json`. On Render, set `STATE_DIR=/var/data` and attach a persistent disk mounted at `/var/data`. Without persistent storage, the app can forget state after a redeploy/restart.

A `render.yaml` file is included. After deploy, run:

```bash
curl -X POST https://YOUR-RENDER-SERVICE.onrender.com/admin/test-discord \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Then seed:

```bash
curl -X POST https://YOUR-RENDER-SERVICE.onrender.com/admin/seed \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## How sold-out messages work

The app listens for Square `inventory.count.updated` events. It tracks previous quantity in local state. If a variation goes from above 0 to 0, it posts a red Discord embed with `🔴 SOLD OUT`.

Discord does not support coloring individual words red in normal text, but embed sidebars can be red. This app uses a red embed color plus the red circle emoji for sold-out alerts.

## Security

Treat these like passwords:

- Square access token
- Square webhook signature key
- Discord webhook URL
- Admin token

Never put them in GitHub.


### New item + inventory race condition note

Square can sometimes send `inventory.count.updated` for a newly-created item before the delayed catalog sync finishes. This version treats an inventory event for an item that is not yet in the saved state as a new item announcement, then records its inventory. Run `/admin/seed` after deployment so existing items are already known and only truly new items are announced this way.


## Variation / duplicate inventory event safety

This version serializes inventory webhook processing, remembers processed Square event IDs, and ignores stale inventory count updates when the incoming `calculated_at` timestamp is not newer than the count already saved in state. This prevents repeated back-in-stock / sold-out loops caused by retried or out-of-order Square inventory webhooks, especially on items with multiple variations.

Recommended Render env vars:

```env
IGNORE_STALE_INVENTORY_EVENTS=true
PROCESSED_EVENT_RETENTION_HOURS=72
```

# Square Catalog + Inventory → Discord Webhook

This app watches a Square catalog category, such as `TCG Singles`, and posts to Discord when:

- a new item is added to the watched category
- inventory quantity changes for an item variation in that category
- inventory drops to 0, which posts as a red `SOLD OUT` embed

Existing catalog edits such as price changes are ignored by default.

## Important limitation about item links

Square can sometimes return `item_data.ecom_uri` for a Square Online item, but Square marks that field as deprecated and it is often missing. Because of that, this app defaults to `LINK_MODE=direct_only`, which means it only posts a direct item link when Square gives one. It will not invent a broken search URL by default.

If you later find a reliable URL pattern for your storefront, you can use `LINK_MODE=template` and `STORE_ITEM_URL_TEMPLATE`.

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
LINK_MODE=direct_only
```

Optional link settings:

```env
# Recommended if Square direct links are missing and you do not want any item link:
LINK_MODE=none

# Use your general store/category URL if no Square direct URL exists:
LINK_MODE=fallback
STORE_FALLBACK_URL=https://lctcg.com

# Use a search page only if your storefront actually honors ?q= search terms:
LINK_MODE=search
STORE_SEARCH_URL=https://lctcg.com/s/search

# Use this only if you discover a reliable item URL pattern:
LINK_MODE=template
STORE_ITEM_URL_TEMPLATE=https://example.com/product/{slug}
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

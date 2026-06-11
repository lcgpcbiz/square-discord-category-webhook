# Square Catalog Category → Discord Webhook

This starter app watches Square catalog changes and posts to a Discord channel when an item is added or updated in a configured Square category, such as `Singles`.

## What it does

Square sends a `catalog.version.updated` webhook when any catalog object changes. That webhook does not include the specific item that changed. This app receives the webhook, verifies Square's signature, asks Square which items or item variations changed since the last sync, filters them by category, compares them to local state, and posts the relevant notices to Discord.

## Requirements

- Node.js 18+
- A public HTTPS URL for this app, such as Render, Railway, Fly.io, a VPS, or ngrok for testing
- Square Developer access token
- Square webhook signature key
- Discord incoming webhook URL

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
cp .env.example .env
```

3. Fill out `.env`.

Important: `PUBLIC_WEBHOOK_URL` must exactly match the URL you enter in Square Developer Console, including `/square-webhook`.

4. Test Discord:

```bash
npm run test-discord
```

5. Seed current Square catalog state so existing items do not all post to Discord:

```bash
npm run seed
```

6. Start the server:

```bash
npm start
```

7. In Square Developer Console, create a webhook subscription:

- Environment: Production, unless testing sandbox
- URL: `https://your-domain.com/square-webhook`
- Event: `catalog.version.updated`
- Copy the signature key into `.env`

8. Create or update an item in the watched Square category and confirm Discord receives the notice.

## Notes

- Use `CATEGORY_ID` if possible. Category names can change; IDs are stable.
- If `CATEGORY_ID` is blank, the app tries to find the category by exact `CATEGORY_NAME` match.
- `ANNOUNCE_ADDS` and `ANNOUNCE_UPDATES` can be set to `true` or `false`.
- `ROLE_MENTION_ID` can be used to ping a Discord role.
- `SHOW_ITEM_IMAGE=true` adds the first Square item image to the Discord embed when the item has an attached catalog image.
- Item links use Square `item_data.ecom_uri` when Square returns it. Because Square marks that field as deprecated, set `STORE_SEARCH_URL` or `STORE_FALLBACK_URL` as a fallback.

## Security

Do not expose your Square access token, Square signature key, or Discord webhook URL publicly. Treat a Discord webhook URL like a password because anyone with it can post to that Discord channel.


## Render deployment notes

The app stores sync state in `state.json` so it knows which Square items are new versus already-existing. On Render, set `STATE_DIR=/var/data` and attach a persistent disk mounted at `/var/data`. Without persistent storage, the app can forget its state after a redeploy/restart and may repost existing items.

A `render.yaml` file is included for Blueprint-style deployment. You still need to set the secret environment variables in the Render dashboard:

- `PUBLIC_WEBHOOK_URL`
- `SQUARE_ACCESS_TOKEN`
- `SQUARE_SIGNATURE_KEY`
- `DISCORD_WEBHOOK_URL`
- `ADMIN_TOKEN`
- optionally `CATEGORY_ID`, `ROLE_MENTION_ID`, `SHOW_ITEM_IMAGE`, `STORE_SEARCH_URL`, and `STORE_FALLBACK_URL`

After deployment, seed the catalog state once by making a protected POST request:

```bash
curl -X POST https://YOUR-RENDER-SERVICE.onrender.com/admin/seed \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

You can test Discord with:

```bash
curl -X POST https://YOUR-RENDER-SERVICE.onrender.com/admin/test-discord \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Your Square webhook URL should be:

```text
https://YOUR-RENDER-SERVICE.onrender.com/square-webhook
```

That exact URL must also be saved as `PUBLIC_WEBHOOK_URL` in Render.

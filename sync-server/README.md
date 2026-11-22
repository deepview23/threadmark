# Threadmark sync server

A tiny Cloudflare Worker that stores each reader's library **encrypted**. Libraries are
encrypted on the reader's device with a key derived from their private sync code; the
server only ever sees scrambled data, a vault id and a hashed access token.

## Set up (Cloudflare dashboard, no coding)
1. Storage → **KV** → Create a namespace called `threadmark-vaults`.
2. **Workers & Pages** → Create → Worker → name it `threadmark-sync` → Deploy.
3. Edit code → replace everything with `worker.js` → Deploy.
4. Worker → Settings → Bindings → Add → KV namespace → variable name `VAULTS`, namespace `threadmark-vaults`.
5. Copy the Worker URL (e.g. `https://threadmark-sync.<you>.workers.dev`) and build the app with
   `VITE_SYNC_URL=<that URL> npm run build`.

## Free plan limits
Cloudflare's free KV allowance is 1,000 writes a day across all users. The app sends at most
one write a minute per device while someone is editing, so this covers personal use and a
small number of readers. Move to the Workers paid plan before selling widely.

## Local testing
`node sync-server/dev-server.mjs 8787` runs the Worker with in-memory storage.

# Threadmark 1.0

Read the story. Map the threads. A private, visual reader's companion for characters, relationships, family trees, timelines, locations, factions and theories.
An installable web app (PWA). It works offline, and all data stays on the reader's device.

## What's in this folder
- `src/` – the app's code (React + TypeScript, React Flow canvas, IndexedDB storage)
- `public/` – icons
- `package.json` – the list of building blocks it uses

## To build it yourself (or hand it to Claude Code)
1. Install Node.js 20 or newer.
2. In this folder, run `npm install`, then `npm run build`.
3. The finished app is created in the `dist` folder. Upload that folder to any static host (Netlify, Cloudflare Pages, Vercel).

`npm run dev` runs it locally at http://localhost:5173 for testing.

## How data is stored
- Each atlas is saved in the browser's IndexedDB on the device, with a daily snapshot kept for 7 days.
- Readers back up and move atlases with Export / Import (JSON files).
- Installed to the Home Screen or Dock, the app asks the browser to keep its data permanently.

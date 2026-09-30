# Persistent Dungeon · Evermere

A browser survival/exploration game with a streamed, procedural 3D medieval wilderness.

**Play:** https://joramvanloenen.github.io/persistent-dungeon/

## First version

- 65.4 × 65.4 km seeded terrain, hills and valleys, six biomes, rivers and lake basins.
- Thousands of deterministic settlements connected by roads and timber bridges.
- Random village spawn, click/tap movement, WASD, movable camera, minimap and waypoint atlas.
- Wood, stone, berries, fiber, inventory, relaxed hunger/thirst, wells and village rest.
- Stable NPC identities, full saved conversations, searchable memory and information shared between travelers.
- Persistent event log and authoritative resource claims/revision checks when connected to the backend.
- Mobile support and a lower rendering quality option.

## Important: persistence status

The default Pages build is a **local preview** until a backend is configured. It saves in the browser, offers export/import, and clearly shows that shared saves are not connected. GitHub Pages cannot run a database.

The complete Supabase backend and alternative Node/SQLite server are included. Follow [backend setup](backend/README.md) to enable account saves across devices, shared resource depletion, other travelers, and shared NPC memories. All live player data remain in that database, not this repository.

NPC replies currently use a transparent, deterministic memory and keyword system. Every successful message is stored verbatim; replies can recall it. This version does not call an LLM. Building and combat are not implemented yet.

## Run and test

Serve the root folder with any static server, e.g. `python3 -m http.server 8080`, then open `http://localhost:8080`. No installation/build is needed. JavaScript modules must be served over HTTP.

`node --test tests/*.test.mjs` runs generation, action validation, persistence, concurrency, and archived NPC recall checks. Node 22.13+ is needed for the SQLite backend.

## Architecture

- `src/world.js`: immutable seed, versioned generation, settlement/resource/NPC IDs.
- `src/render.js`: Three.js chunk streaming, terrain, water, bridges, settlements, vegetation and camera.
- `src/rules.js`: shared gameplay validation and NPC recall.
- `src/storage.js`: local preview, Supabase Edge Function, or self-hosted server adapter.
- `src/main.js`, `src/map.js`: game UI and maps.
- `backend/schema.sql`, `supabase/functions/world/index.ts`: transactional production backend.
- `backend/server.mjs`: self-hosted SQLite alternative with accounts.

New permanent mechanics should add validated actions, atomic state changes, and append-only events. Preserve existing seed and identifiers. Building can add an indexed world-structures table and a `build` action without replacing player saves.

Three.js is bundled locally under its MIT license. Supabase client is bundled for the optional cloud connection.

GitHub Pages is configured to publish the root of `main`; the root `index.html` and relative asset paths support the repository subpath. `.nojekyll` keeps module files unmodified. No deployment workflow is required.

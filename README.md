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

## Expansion: homes, ruins, and dungeons

Every player now receives a new, individually owned cottage on a vacant village plot. Existing saves gain a home while preserving supplies and all NPC conversations. Every page load/sign-in starts the traveler at their own doorstep; leaving a dungeon during the session returns to its entrance. Dungeon exploration and collected supplies remain saved even when the traveler returns home.

Ancient ruins appear near settlements and on the atlas as diamonds. Approach an arch to choose whether to enter. The cave marker shows two separate states: hollow/filled diamond for unexplored/entered (check when all chambers are visited), and a supply mark (check when all deposits have been gathered). Dungeons contain 9–12 connected chambers, branching corridors, mineral deposits, timber, cloth, dried provisions, and stairs back to the surface. Click movement finds a walkable path through corridors. The dungeon map reveals visited chambers.

NPC conversation now shows only the current RPG dialogue line and topic choices. Past exchanges are available only through **Conversation journal**, with earlier pages available on demand. Replies still use persistent memory and authored dialogue rules rather than an LLM.

The expansion adds biome-specific broadleaf trees and conifers, bushes, grass, flowers, reeds, personal gardens, denser scenery, correct backpack orientation, and less distant fog when zooming out.

For an already configured Supabase backend, run the new `Expansion v2` section at the end of `backend/schema.sql` and redeploy the `world` function. For the SQLite backend, restart the updated server; it adds the new homes and resource-space schema without removing existing data. The public Pages build remains a local preview until that shared backend is connected.

# Shared world setup

GitHub Pages serves the game, but cannot run a database. The application deliberately labels its unconnected mode **Local preview**. It never claims that device-only saves are shared.

## Supabase (recommended)

1. Create a Supabase project in your account.
2. Execute `backend/schema.sql` once in its SQL editor.
3. Deploy `supabase/functions/world/index.ts` as the `world` Edge Function. It imports the same immutable generation and action rules as the game. With the Supabase CLI, run `supabase functions deploy world --no-verify-jwt`. The function verifies user tokens itself through Auth before any access.
4. Set Edge Function secret `GAME_ORIGIN=https://joramvanloenen.github.io`. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function automatically. Never put the service key in the repository or client.
5. Enable email/password authentication. Add `https://joramvanloenen.github.io/persistent-dungeon/` to Auth's redirect allowlist. Set the Site URL to the same address. With email confirmations enabled, players confirm their email before their first sign-in.
6. In root `config.js`, set `supabaseUrl` and `supabasePublishableKey` to the project URL and **publishable** (or legacy anon) key. Keep `apiUrl` empty. Commit these public settings to main.

Everyone now uses the same world, with account-owned travelers and globally depleted resources. Sign in to the same account on other devices. NPCs store every exchange in the database, indexed by stable NPC ID. Their recall searches archived messages in addition to recent context. NPC dialogue is a deterministic memory/keyword system, not an LLM; it can quote and recall information, but does not reason like a language model.

## Self-hosted server

An alternative complete server uses Node 22.13+ and built-in SQLite. No package installation is needed:

```
GAME_ORIGIN=https://joramvanloenen.github.io GAME_DATABASE=/persistent-disk/evermere.sqlite PORT=8080 node backend/server.mjs
```

Place it behind HTTPS with a persistent disk and backups, then set `apiUrl` in `config.js` to its HTTPS origin. For local development, run it with default settings and set `apiUrl: 'http://localhost:8080'`. It serves the game too. Accounts use scrypt password hashes and random expiring sessions. User data are checked server-side; resource claims, player updates, memories, and action events commit in a single SQLite transaction.

## Persistence contract and limits

- The fixed seed and generator v1 recreate untouched terrain; edits are append-only events plus materialized state. Never change the seed or ID algorithm in place. New terrain rules require a versioned world and migration.
- Resource depletion is permanent in this first version. Future regeneration should append a new event.
- Every new visit starts at the player’s owned home, including when the previous session ended underground. Supplies, conversations, visited chambers, and cave resource depletion remain saved.
- Movement saves every two seconds while moving. Every confirmed gather, supply action, rename, and conversation commits immediately. Closing abruptly can lose up to two seconds of unsaved movement; the browser warns when possible. A failed save is shown, never treated as successful.
- Two clients of the same account cannot silently overwrite one another: revision checks reject stale writes. Two players cannot claim the same resource.
- NPC memories are shared in the game world and attributed to the traveler name; other players may ask NPCs to recall what they know. Do not put private personal information into public conversations.
- Other nearby players refresh about every 6.5 seconds. This is shared persistent play, not a low-latency multiplayer combat server.
- Survival is relaxed and pauses offline; food/water decline with distance, bottom out at 5, and do not kill the player.
- The world is 65.4 km across with streamed terrain, six biomes, lake basins, continuous river channels, roads, bridges, and thousands of deterministic settlements. Rendered objects are low-poly meshes, without external artwork.
- Building is intentionally not implemented yet. Resource IDs, persistent action events, generator version, and authoritative mutation checks provide the foundation.

## Action and forge update

Deploy the updated shared source to enable smith payments, material trading, timed forging, equipment, jump/attack events, and saved sentinel progression. Player JSON gains these fields automatically while preserving existing inventory, homes, and memories. Node/SQLite needs a server restart. Supabase needs the updated `world` function and the final `apply_game_action` definition in `schema.sql`, whose general action limit is now 300/minute to support gameplay; the conversation limit stays 20/minute. No new tables are required.

Each accepted forge step and combat action is stored atomically with its event. Paid forge jobs store their phase, start time, deadline, pattern step, and mistakes. Crafted weapons and equipment survive reloads; the action validator rejects unpaid, distant, mistimed, stale, or duplicate attempts. Sentinel health and rewards are stored per traveler.

Back up the database. Static source in GitHub is not a backup of live world data.

## Collision update

Deploy the updated shared source and restart Node, or redeploy the Supabase `world` function. Movement validation now checks surface obstacle footprints and the entire saved trail, using nearby database homes and depleted resources. No schema migration is needed for this update.

## The Fringe genre conversion

Deploy the updated shared `src/` code and restart the Node server, or redeploy the Supabase `world` function. No new SQL migration is required. Existing seed, IDs, inventory keys, homes, account tokens, and conversation rows stay compatible. Known medieval weapons acquire sci-fi display names while retaining their IDs and stats.

Player JSON now includes `planet`, `visitedPlanets`, a one-use `arrivalVoucher`, landing metadata, and `inventory.powerballs`. Planet transit validates a colony/pod departure point, unfinished fabrication, and the selected fare (four credits or one Powerball after the voucher). Refining/trading validates proximity and inventory. All use the existing transactional action/event path, so the backend owns payment, discoveries, and resource claims. Surfaces occupy nine bounded regions in the existing seeded coordinate space. Players always start each session at their original landing pod; discovered planets remain remembered.

The field guide and NPC topic replies use the supplied Fringe history. Player messages remain stored verbatim; this update does not replace the NPC memory system or introduce an LLM.

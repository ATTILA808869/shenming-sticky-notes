# Nezha co-op battle service

This service hosts the first, separate two-player scenario. It simulates the map, monsters, qi attacks, health and shared guardian progression in one Node process. It does not use the solo leaderboard, change solo unlocks, or provide checkpoints across a service restart. Solo relic builds are not yet available in this scenario.

1. Install the dependencies in this directory and run `npm start` on a persistent Node host. Route `/room` through the host's WSS proxy and use `GET /health` for health checks.
2. On the room host set `HOST=0.0.0.0`, `PORT`, `NEZHA_BATTLE_ORIGIN` to the exact website origin, and `NEZHA_BATTLE_SECRET` to a separate random server secret of at least 32 characters. Do not use a GM or player key.
3. On the website set `NEZHA_COOP=1`, `NEZHA_BATTLE_URL=wss://BATTLE_HOST/room`, and the same `NEZHA_BATTLE_SECRET`. Keep the site and room service paired by release. Without those variables the co-op entry stays hidden.
4. Run a single replica for the in-memory preview. Do not enable horizontal replicas until room routing is shared, or players may land in different processes. A player may reconnect to the running room for 90 seconds; saved floor progress and recovery after a server restart are separate work.

Run the engine tests with `node --test engine.test.cjs`. The loopback preview can use `NEZHA_BATTLE_LOCAL=1` and the repository's bundled WebSocket library without a separate install; that fallback is not the deployment setup.

## Render settings

Create one Node Web Service from branch `release/0.112301`. Set Root Directory to `services/nezha-battle`, Build Command to `npm install --omit=dev`, Start Command to `npm start`, and Health Check Path to `/health`. Leave Render's injected `PORT` in place. Set the origin to `https://shenming-sticky-notes.vercel.app` and configure the shared key in both providers' secret settings, never in Git or chat.

# Nezha co-op battle service

This service runs the two-player story and endless tower in one authoritative Node process. It shares character, skill, enemy, and tower rules with the solo game in `lib/nezha/assets`. The website validates signed room results and updates the existing individual leaderboard and character unlocks. Active fights are not persisted across a service restart.

1. Install the dependencies in this directory and run `npm start` on a persistent Node host. Route `/room` through the host's WSS proxy and use `GET /health` for health checks.
2. On the room host set `HOST=0.0.0.0`, `PORT`, `NEZHA_BATTLE_ORIGIN` to the exact website origin, and `NEZHA_BATTLE_SECRET` to a separate random server secret of at least 32 characters. Do not use a GM or player key.
3. On the website set `NEZHA_COOP=1`, `NEZHA_BATTLE_URL=wss://BATTLE_HOST/room`, and the same `NEZHA_BATTLE_SECRET`. Keep the site and room service paired by release. Without those variables the co-op entry stays hidden.
4. Run a single replica until there is shared room routing. A player may reconnect to a running room for 90 seconds. Saved leaderboard scores survive restarts; active room state does not.

Run the engine tests with `node --test engine.test.cjs`. The loopback preview can use `NEZHA_BATTLE_LOCAL=1` and the repository's bundled WebSocket library without a separate install; that fallback is not the deployment setup.

## Render settings

Use branch `release/0.112301` and leave Root Directory blank so both the service and the shared game rules are present. Build with `npm install --prefix services/nezha-battle --omit=dev`, start with `node services/nezha-battle/server.cjs`, and use `/health` for HTTP health checks. Leave Render's injected `PORT` in place. Set the origin to `https://shenming-sticky-notes.vercel.app` and configure the shared key in both providers' secret settings, never in Git or chat.

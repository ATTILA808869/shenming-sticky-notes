const { createHmac, timingSafeEqual } = require("node:crypto");
const { createServer } = require("node:http");
const { createRoom, connect, disconnect, retirePlayer, setInput, chooseReward, pendingReward, tick, snapshot } = require("./engine.cjs");
const { isTowerRelic } = require("../../lib/nezha/assets/battle-rules.js");

function signResult(secret, p, now = Date.now()) {
  if (!p?.enteredTower) return null;
  const payload = Buffer.from(JSON.stringify({
    player: p.id, cleared: p.creditedFloor, kills: p.creditedKills, expires: now + 5 * 60_000
  })).toString("base64url");
  const mac = createHmac("sha256", secret).update("nezha-battle-result:" + payload).digest("base64url");
  return payload + "." + mac;
}

function playerView(base, p) {
  const visible = item => Math.abs(item.x - p.x) <= 880 && Math.abs(item.y - p.y) <= 820;
  const nearbyLoot = [], relics = [];
  for (const item of base.loot) {
    if (isTowerRelic(item.kind)) relics.push(item);
    else if (visible(item)) nearbyLoot.push(item);
  }
  return { ...base, enemies: base.enemies.filter(e => e.guardian || visible(e)),
    bolts: base.bolts.filter(visible), loot: [...nearbyLoot.slice(-280), ...relics], effects: base.effects.filter(visible),
    sparks: base.sparks.filter(s => s.kind === "bomb" || visible(s)), reward: pendingReward(p) };
}

function verifyTicket(secret, ticket, now = Date.now()) {
  if (typeof ticket !== "string" || ticket.length > 2048 || !/^[\w-]+\.[\w-]{43}$/.test(ticket)) return null;
  const [payload, sig] = ticket.split(".");
  const expected = createHmac("sha256", secret).update("nezha-battle:" + payload).digest();
  const supplied = Buffer.from(sig, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const item = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!/^[a-z0-9]{20,40}$/.test(item.party) || !Array.isArray(item.roster) || item.roster.length !== 2 ||
      !Number.isSafeInteger(item.expires) || item.expires <= now || item.expires > now + 120_000 ||
      item.roster.some(p => !/^[a-z0-9]{20,40}$/.test(p.id) || typeof p.name !== "string" || p.name.length > 32 ||
        !["nezha", "jigong"].includes(p.character)) ||
      item.roster[0].id === item.roster[1].id || !item.roster.some(p => p.id === item.player)) return null;
    return item;
  } catch { return null; }
}

function startBattleServer({ secret, origin, port, host, WebSocketServer }) {
  if (!secret || secret.length < 32 || !origin) throw new Error("A 32-character battle key and allowed web origin are required.");
  const rooms = new Map(), maxRooms = 96, maxClients = 240;
  const http = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end('{"ready":true,"battle":"tower-coop-v2"}');
    }
    res.writeHead(404);res.end();
  });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 2800, perMessageDeflate: false });
  http.on("upgrade", (req, socket, head) => {
    if (req.url !== "/room" || req.headers.origin !== origin || sockets.clients.size >= maxClients) return socket.destroy();
    sockets.handleUpgrade(req, socket, head, ws => sockets.emit("connection", ws));
  });
  sockets.on("connection", ws => {
    let joined, player, seat, messages = 0, inputWindow = Date.now();
    const handshaking = setTimeout(() => ws.close(4001, "join required"), 5000);
    ws.on("error", () => ws.terminate());
    ws.on("pong", () => { ws.alive = true; });
    ws.alive = true;
    ws.on("close", () => {
      clearTimeout(handshaking);
      if (joined && joined.clients.get(player) === ws) {
        joined.clients.delete(player);disconnect(joined.room, player);
        if (!joined.clients.size && ["lost", "won", "closed"].includes(joined.room.state)) rooms.delete(joined.key);
      }
    });
    ws.on("message", data => {
      const now = Date.now();
      if (now - inputWindow >= 1000) { inputWindow = now; messages = 0; }
      if (++messages > 40) return ws.close(4008, "too many messages");
      let event;
      try { event = JSON.parse(data.toString()); } catch { return ws.close(4002, "invalid message"); }
      if (!event || typeof event !== "object") return ws.close(4002, "invalid message");
      if (joined) {
        if (joined.clients.get(player) !== ws) return;
        if (event.type === "move") setInput(joined.room, player, event.x, event.y);
        if (event.type === "pick") chooseReward(joined.room, player, event.rewardId, event.optionId);
        if (event.type === "result") ws.send(JSON.stringify({ type: "result", proof: signResult(secret, seat, now), cleared: seat.creditedFloor,
          id: Number.isSafeInteger(event.id) ? event.id : undefined }));
        if (event.type === "retire") {
          retirePlayer(joined.room, player, now);
          ws.send(JSON.stringify({ type: "retired" }));
        }
        return;
      }
      const ticket = event.type === "join" ? verifyTicket(secret, event.ticket, now) : null;
      if (!ticket) return ws.close(4001, "invalid ticket");
      const key = ticket.party;
      joined = rooms.get(key);
      if (!joined) {
        if (rooms.size >= maxRooms) return ws.close(4003, "room capacity");
        joined = { key, room: createRoom(ticket.roster, now), clients: new Map(), finishedAt: null };
        rooms.set(key, joined);
      }
      player = ticket.player;
      if (!connect(joined.room, player, now)) { joined = null; return ws.close(4004, "seat expired"); }
      const previous = joined.clients.get(player);
      seat = joined.room.players.find(p => p.id === player);
      joined.clients.set(player, ws);
      previous?.close(4005, "joined elsewhere");
      clearTimeout(handshaking);
      ws.send(JSON.stringify({ type: "joined", player, state: playerView(snapshot(joined.room), seat) }));
    });
  });
  const clock = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of rooms) {
      tick(entry.room, .05, now);
      if (entry.room.state === "won" || entry.room.state === "lost") entry.finishedAt ??= now;
      if (entry.room.state === "closed" || (entry.finishedAt !== null && now - entry.finishedAt > 180_000)) {
        for (const client of entry.clients.values()) client.close(4004, "room closed");
        rooms.delete(id);continue;
      }
      if (entry.clients.size) {
        const base = snapshot(entry.room);
        for (const p of entry.room.players) {
          const client = entry.clients.get(p.id);
          if (client?.readyState === 1 && client.bufferedAmount < 64_000) {
            client.send(JSON.stringify({ type: "state", state: playerView(base, p) }));
          }
        }
      }
    }
  }, 50);
  const heartbeat = setInterval(() => {
    for (const socket of sockets.clients) {
      if (!socket.alive) socket.terminate();
      else { socket.alive = false;socket.ping(); }
    }
  }, 15_000);
  http.on("close", () => { clearInterval(clock); clearInterval(heartbeat); });
  http.listen(port, host);
  return { http, close: () => {for (const client of sockets.clients) client.terminate();http.close();} };
}

if (require.main === module) {
  let ws;
  try { ws = require("ws"); } catch (error) {
    if (process.env.NEZHA_BATTLE_LOCAL !== "1") throw error;
    ws = require("next/dist/compiled/ws");
  }
  const { http } = startBattleServer({
    secret: process.env.NEZHA_BATTLE_SECRET, origin: process.env.NEZHA_BATTLE_ORIGIN,
    port: Number(process.env.PORT ?? 3020), host: process.env.HOST ?? "127.0.0.1",
    WebSocketServer: ws.WebSocketServer
  });
  http.on("listening", () => console.log("Nezha battle listening on port " + http.address().port));
}

module.exports = { verifyTicket, signResult, startBattleServer, playerView };

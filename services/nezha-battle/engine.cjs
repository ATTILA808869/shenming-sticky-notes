const width = 1040, height = 700;
const graceMs = 90_000;
const stages = [
  { kills: 8, hp: 150, speed: 62, name: "超級大幽靈" },
  { kills: 12, hp: 225, speed: 75, name: "重甲幽靈" },
  { kills: 16, hp: 330, speed: 85, name: "超級龍王" }
];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function createRoom(roster, now = Date.now(), random = Math.random) {
  return {
    state: "waiting", stage: 0, stageKills: 0, kills: 0, spawnAt: 0, time: 0,
    createdAt: now, vacantAt: now, nextId: 1, players: roster.map((p, index) => ({
      id: p.id, name: p.name, character: p.character, x: width / 2 + (index * 2 - 1) * 52,
      y: height / 2, hp: 100, xp: 0, level: 1, connected: false, disconnectedAt: null,
      dx: 0, dy: 0, attackAt: 0
    })),
    enemies: [], bolts: [], random
  };
}

function connect(room, id, now = Date.now()) {
  const player = room.players.find(item => item.id === id);
  if (!player || room.state === "closed" || (player.disconnectedAt !== null && now - player.disconnectedAt > graceMs)) return false;
  player.connected = true;
  player.disconnectedAt = null;
  room.vacantAt = null;
  if (room.state === "waiting" && room.players.every(item => item.connected)) room.state = "live";
  return true;
}

function disconnect(room, id, now = Date.now()) {
  const player = room.players.find(item => item.id === id);
  if (!player || !player.connected) return;
  player.connected = false;
  player.disconnectedAt = now;
  player.dx = player.dy = 0;
  if (room.players.every(item => !item.connected)) room.vacantAt = now;
}

function setInput(room, id, x, y) {
  const p = room.players.find(item => item.id === id);
  if (!p?.connected || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const length = Math.max(1, Math.hypot(x, y));
  p.dx = x / length; p.dy = y / length;
}

function spawn(room, guardian = false) {
  const stage = stages[room.stage], angle = room.random() * Math.PI * 2;
  room.enemies.push({
    id: room.nextId++, x: width / 2 + Math.cos(angle) * 440, y: height / 2 + Math.sin(angle) * 290,
    hp: guardian ? stage.hp : 28 + room.stage * 10, maxHp: guardian ? stage.hp : 28 + room.stage * 10,
    radius: guardian ? 29 : 12, speed: guardian ? stage.speed : 73 + room.stage * 11,
    guardian, name: guardian ? stage.name : null, hitAt: 0
  });
}

function nearest(origin, list) {
  let near, gap = Infinity;
  for (const item of list) {
    const next = distance(origin, item);
    if (next < gap) { near = item; gap = next; }
  }
  return { near, gap };
}

function tick(room, dt, now = Date.now()) {
  if ((room.vacantAt !== null && now - room.vacantAt >= graceMs) ||
    (room.state === "waiting" && now - room.createdAt >= 5 * 60_000)) room.state = "closed";
  if (room.state !== "live" || room.vacantAt !== null) return;
  const living = room.players.filter(p => p.connected && p.hp > 0);
  if (!living.length) {
    if (room.players.every(p => p.hp <= 0 || (!p.connected && now - p.disconnectedAt > graceMs))) room.state = "lost";
    return;
  }
  room.time += dt;
  const stage = stages[room.stage];
  if (room.time >= room.spawnAt && room.enemies.length < 26) {
    if (room.stageKills >= stage.kills) {
      if (!room.enemies.some(e => e.guardian)) spawn(room, true);
    } else {
      spawn(room);
      if (room.stage > 0) spawn(room);
    }
    room.spawnAt = room.time + 1.45;
  }
  for (const p of living) {
    p.x = clamp(p.x + p.dx * 177 * dt, 18, width - 18);
    p.y = clamp(p.y + p.dy * 177 * dt, 18, height - 18);
    const { near, gap } = nearest(p, room.enemies);
    if (near && gap <= 270 && room.time >= p.attackAt) {
      p.attackAt = room.time + .72;
      room.bolts.push({ id: room.nextId++, target: near, x: p.x, y: p.y, damage: 20 + 3 * (p.level - 1) });
    }
  }
  room.bolts = room.bolts.filter(shot => {
    if (shot.target.hp <= 0) return false;
    const gap = distance(shot, shot.target), step = 470 * dt;
    if (gap <= step + shot.target.radius) { shot.target.hp -= shot.damage; return false; }
    shot.x += (shot.target.x - shot.x) * step / gap;
    shot.y += (shot.target.y - shot.y) * step / gap;
    return true;
  });
  let guardianDown = false;
  room.enemies = room.enemies.filter(enemy => {
    if (enemy.hp <= 0) {
      room.kills++;
      if (enemy.guardian) guardianDown = true;
      else room.stageKills++;
      for (const p of room.players) {
        p.xp += enemy.guardian ? 30 : 5;
        p.level = 1 + Math.floor(p.xp / 30);
      }
      return false;
    }
    const { near, gap } = nearest(enemy, living);
    const reach = enemy.radius + 13;
    if (gap > reach) {
      const step = Math.min(gap - reach, enemy.speed * dt);
      enemy.x += (near.x - enemy.x) * step / gap;
      enemy.y += (near.y - enemy.y) * step / gap;
    } else if (room.time >= enemy.hitAt) {
      near.hp = Math.max(0, near.hp - (enemy.guardian ? 18 : 7 + room.stage));
      enemy.hitAt = room.time + .75;
    }
    return true;
  });
  if (guardianDown) {
    room.stage++;
    room.enemies = []; room.bolts = []; room.stageKills = 0;
    room.spawnAt = room.time + 2.5;
    if (room.stage === stages.length) room.state = "won";
    else for (const p of room.players) p.hp = Math.min(100, p.hp + 30);
  }
}

function snapshot(room) {
  return {
    state: room.state, stage: Math.min(stages.length, room.stage + 1), width, height,
    time: Math.floor(room.time), kills: room.kills, stageKills: room.stageKills, goal: stages[room.stage]?.kills ?? 0,
    players: room.players.map(({ id, name, character, x, y, hp, xp, level, connected }) => ({ id, name, character, x, y, hp, xp, level, connected })),
    enemies: room.enemies.map(({ id, x, y, hp, maxHp, radius, guardian, name }) => ({ id, x, y, hp, maxHp, radius, guardian, name })),
    bolts: room.bolts.map(({ id, x, y }) => ({ id, x, y }))
  };
}

module.exports = { createRoom, connect, disconnect, setInput, tick, snapshot, graceMs };

const R = require("../../lib/nezha/assets/battle-rules.js");
const Combat = require("../../lib/nezha/assets/battle-combat.js");
const width = 2880, height = 2160;
const graceMs = 90_000, reviveRadius = 96, reviveSeconds = 3;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const available = p => p.connected && p.hp > 0;
const withinGrace = (p, now) => p.connected || (p.disconnectedAt !== null && now - p.disconnectedAt <= graceMs);
const from = (x, y, margin = 18) => ({ x: clamp(x, margin, width - margin), y: clamp(y, margin, height - margin) });

function nearest(origin, list) {
  let target, distance = Infinity;
  for (const item of list) {
    const d = gap(origin, item);
    if (d < distance) { target = item; distance = d; }
  }
  return { target, distance };
}

function createRoom(roster, now = Date.now(), random = Math.random) {
  return {
    state: "waiting", time: 0, storyTime: 0, nextBoss: 0, nextWave: 0, waveSlots: 0,
    floor: 0, floorTime: 0, towerTime: 0, floorKills: 0, cleared: 0, kills: 0, graceUntil: 0,
    createdAt: now, vacantAt: now, nextId: 1, nextSpawn: .35, nextAim: 0, miniKills: 0, miniThreshold: 50,
    enemies: [], bolts: [], warnings: [], loot: [], sparks: [], boss: null, random,
    players: roster.map((p, index) => ({
      ...R.createCharacter(p.character), id: p.id, name: p.name,
      x: width / 2 + (index * 2 - 1) * 52, y: height / 2,
      connected: false, disconnectedAt: null, dx: 0, dy: 0, heading: 0, facing: -1,
      attackFacing: -1, attackUntil: -1, attackAt: -1, pendingLevels: 0, gearRewards: 0,
      reward: null, revive: 0, safeUntil: 0, enteredTower: false, creditedFloor: 0, creditedKills: 0,
      combat: Combat.create(R, random)
    }))
  };
}

function connect(room, id, now = Date.now()) {
  const p = room.players.find(item => item.id === id);
  if (!p || room.state === "closed" || (p.disconnectedAt !== null && !withinGrace(p, now))) return false;
  p.connected = true; p.disconnectedAt = null; room.vacantAt = null;
  if (room.state === "waiting" && room.players.every(item => item.connected)) room.state = "live";
  return true;
}

function disconnect(room, id, now = Date.now()) {
  const p = room.players.find(item => item.id === id);
  if (!p?.connected) return;
  p.connected = false; p.disconnectedAt = now; p.dx = p.dy = p.revive = 0;
  // Interrupt the rescue immediately, even if the survivor reconnects before the next tick.
  for (const member of room.players) member.revive = 0;
  if (room.players.every(item => !item.connected)) room.vacantAt = now;
}

function setInput(room, id, x, y) {
  const p = room.players.find(item => item.id === id);
  if (!p?.connected || !Number.isFinite(x) || !Number.isFinite(y)) return;
  x = clamp(x, -1, 1); y = clamp(y, -1, 1);
  const length = Math.max(1, Math.hypot(x, y));
  p.dx = x / length; p.dy = y / length;
}

function addXP(room, p, amount) {
  p.xp += amount;
  for (let cost; p.xp >= (cost = R.levelCost(p.level + 1, Boolean(room.floor)));) {
    p.xp -= cost; R.gainLevel(p); p.pendingLevels++;
  }
}

function offer(room, p, title, options, follow = null) {
  p.reward = { id: room.nextId++, title, options, follow };
}
function refreshReward(room, p) {
  if (p.reward) return;
  if (p.gearRewards) offer(room, p, "小魔王戰利品", R.gearChoices(p));
  else if (p.pendingLevels) offer(room, p, "升級強化", R.levelChoices(p, room.random));
}
function chooseReward(room, id, rewardId, optionId) {
  const p = room.players.find(item => item.id === id);
  const reward = p?.reward;
  if (room.state !== "live" || !p || !available(p) || !reward || reward.id !== rewardId || !Number.isSafeInteger(optionId)) return false;
  const option = reward.options[optionId];
  if (!option?.apply && option?.learn === undefined) return false;
  if (option.learn !== undefined) {
    const index = option.learn, name = R.activeSkills(p)[index];
    const route = pattern => offer(room, p, name + "・強化路線", R.skillRoutes(p, index).map(choice => ({
      label: choice.label, apply: () => R.learnSkill(p, index, pattern, choice.key)
    })), "level");
    if (p.character === "nezha" && index === 0) {
      offer(room, p, name + "・發射型態", R.patterns.map((label, i) => ({ label, apply: () => route(i) })), "pattern");
    } else route(0);
    return true;
  }
  option.apply();
  if (reward.follow === "pattern") return true;
  if (reward.title === "小魔王戰利品") p.gearRewards--;
  else p.pendingLevels--;
  p.reward = null; refreshReward(room, p);
  return true;
}

function heal(p, fraction) {
  if (p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * fraction);
}
function hurt(room, p, value) {
  if (!available(p) || room.time < p.safeUntil) return;
  p.hp = Math.max(0, p.hp - R.hitValue(value, p.defense));
  if (!p.hp) p.revive = 0;
}
function reviveTeam(room, dt) {
  for (const p of room.players) {
    if (!p.connected || p.hp > 0 || !room.players.some(other => available(other) && gap(p, other) <= reviveRadius)) {
      p.revive = 0;
      continue;
    }
    p.revive += dt;
    if (p.revive + 1e-8 < reviveSeconds) continue;
    p.hp = Math.ceil(p.maxHp * .30); p.revive = 0; p.safeUntil = room.time + 1.5;
    room.sparks.push({ x: p.x, y: p.y, r: 52, life: .65, kind: "heal" });
  }
}

function combatBalance(room) {
  if (room.baseline) return room.baseline;
  const time = room.floor ? R.storyDuration + room.towerTime : room.storyTime;
  const balances = room.players.map(p => R.enemyBalance(p, time, room.miniThreshold > 50));
  const mean = key => (balances[0][key] + balances[1][key]) / 2;
  return { time, attackGrowth: mean("attackGrowth"), durability: mean("durability"),
    level: mean("level"), burst: mean("burst"), miniAttackScaling: room.miniThreshold > 50 };
}
function strengths(room, balance) {
  const tower = room.floor ? R.towerFloorGrowth ** Math.max(0, room.floor - R.towerBaselineFloor) : 1;
  return { health: tower * (room.floor ? R.towerHealthBoost : 1),
    attack: balance.durability * tower * (room.floor ? R.towerDamageBoost : 1) };
}
function origin(room, p, radius, angle = room.random() * Math.PI * 2) {
  let x = p.x + Math.cos(angle) * radius, y = p.y + Math.sin(angle) * radius;
  if (x < 18 || x > width - 18) x = p.x - Math.cos(angle) * radius;
  if (y < 18 || y > height - 18) y = p.y - Math.sin(angle) * radius;
  return from(x, y);
}
function spawnMob(room, p, balance, wave, kind, mini = false, angle) {
  const strength = strengths(room, balance);
  const stats = mini ? R.miniStats(R.miniTypes[Math.floor(room.random() * R.miniTypes.length)], balance, strength.health, strength.attack)
    : R.mobStats(kind, balance, wave, strength.health, strength.attack);
  room.enemies.push({ ...stats, ...origin(room, p, mini ? 185 : 305 + room.random() * (wave ? 160 : 66), angle),
    id: room.nextId++, phase: room.random() * 6, stun: 0, flash: 0,
    contact: new Map(), wheels: new Map(), rangedReadyAt: room.time + 1.4 + room.random() * 2.2,
    abilityAt: room.time + 2 + room.random() * 3 });
}
function spawnBoss(room, p) {
  const balance = combatBalance(room);
  const strength = strengths(room, balance), floor = Math.min(room.floor, R.towerBaselineFloor);
  const guardian = room.floor ? R.towerGuardians[(room.floor - 1) % R.towerGuardians.length] : R.bossStages[room.nextBoss++];
  const guardianTime = room.baseline ? 0 : room.floorTime;
  const hp = R.bossHealth(room.floor ? 1100 + floor * 340 + guardianTime * 1.25 : guardian.hp, balance, floor, strength.health * 1.35);
  const attack = (room.floor ? 43 + floor * 7 + guardianTime * .04 : guardian.attack) * strength.attack;
  room.boss = { ...guardian, ...origin(room, p, 207), id: room.nextId++, guardian: true,
    kind: room.floor || guardian.at === R.storyDuration ? "dragon" : "boss",
    r: room.floor ? 49 : guardian.r, speed: guardian.speed + floor * 2, hp, maxHp: hp, attack,
    name: room.floor ? "第 " + room.floor + " 層・" + guardian.name : guardian.name,
    start: room.time, castAt: room.time + 2, cast: 0, flash: 0, stun: 0, contact: new Map(), wheels: new Map() };
  room.enemies.push(room.boss);
}
function spawns(room, living) {
  if (room.boss || room.time < room.graceUntil) return;
  if (room.floor ? room.floorKills >= R.towerGoal : R.bossStages[room.nextBoss]?.at <= room.storyTime + 1e-8) {
    spawnBoss(room, living[Math.floor(room.random() * living.length)]); return;
  }
  const cap = room.floor ? 210 : 105;
  const balance = combatBalance(room);
  const wave = !room.floor && R.storyWaves[room.nextWave];
  if (wave && room.storyTime >= wave.at) {
    const age = Math.min(room.storyTime - wave.at, wave.duration);
    const slots = Math.floor(wave.count * age / wave.duration * 1.35);
    for (let i = room.waveSlots; i < slots && room.enemies.length < cap; i++) {
      spawnMob(room, living[i % living.length], balance, true, wave.kinds[i % wave.kinds.length], false,
        wave.split ? (i % 2) * Math.PI + (room.random() - .5) * Math.PI / 3 : undefined);
    }
    room.waveSlots = slots;
    if (age >= wave.duration) { room.nextWave++; room.waveSlots = 0; }
  } else if (room.time >= room.nextSpawn) {
    const batch = room.floor ? Math.min(22, 14 + room.floor + Math.floor(room.floorTime / 70))
      : 1 + Math.floor(room.storyTime / 120) + (living.length === 2 && room.random() < .4 ? 1 : 0);
    const anchor = room.nextId;
    for (let i = 0; i < batch && room.enemies.length < cap; i++) {
      spawnMob(room, living[(anchor + i) % living.length], balance, Boolean(room.floor),
        R.enemyKind(room.floor ? R.storyDuration : room.storyTime, room.random()));
    }
    room.nextSpawn = room.time + (room.floor ? .66 : Math.max(.65, 1.55 - room.storyTime * .0015 - Math.max(0, room.storyTime - 300) * .001));
  }
}
function movePlayers(room, living, dt) {
  for (const p of living) {
    p.prevX = p.x; p.prevY = p.y;
    const speed = p.speed * 210 / R.baseStats.speed;
    Object.assign(p, from(p.x + p.dx * speed * dt, p.y + p.dy * speed * dt, 22));
    if (p.dx || p.dy) p.heading = Math.atan2(p.dy, p.dx);
    if (p.dx) p.facing = Math.sign(p.dx);
  }
}
function playerAttacks(room, dt) {
  for (const p of room.players) {
    const active = available(p), combat = p.combat;
    combat.frame(p, room.time, width, height, room.boss, room.sparks);
    combat.updateSkills(dt, room.enemies, active);
    if (active) combat.updateIngots(dt, room.enemies);
    if (combat.effects().jigongWindCasts.length) combat.advanceJigongWind(dt, room.enemies);
    const start = p.wheelAngle, sweep = p.wheelSpeed * dt;
    p.wheelAngle = (start + sweep) % (Math.PI * 2);
    if (!active || !p.wheels) continue;
    const flaming = p.evolved[1], radius = R.wheelHitRadius * (flaming ? R.wheelEvolutionScale : 1);
    for (const e of room.enemies) {
      if (e.hp <= 0 || room.time < (e.wheels.get(p.id) ?? 0) || !combat.wheelSweepsEnemy(e, start, sweep, radius)) continue;
      e.wheels.set(p.id, room.time + R.wheelCooldown); combat.damage(e, p.wheelDamage);
      if (room.time >= p.attackUntil + .14) combat.poseForAttack(e);
      if (flaming && e.hp > 0 && room.time >= (e.wheelKnockback ?? 0)) {
        const d = gap(e, p) || 1, force = e.name ? 24 : 55;
        Object.assign(e, from(e.x + (e.x - p.x) * force / d, e.y + (e.y - p.y) * force / d));
        e.knockedBackAt = room.time; e.wheelKnockback = room.time + R.wheelKnockbackCooldown;
      }
    }
  }
}

function enemyAttack(room, e) {
  const pressure = e.guardian ? clamp((room.time - e.start - 25) / 50, 0, 1) : 0;
  return e.attack * (1 + pressure * .20);
}
function moveEnemies(room, living, dt) {
  const grid = new Map();
  for (const e of room.enemies) {
    e.stun -= dt; e.flash -= dt;
    if (e.hp <= 0 || e.stun > 0 || e.knockedBackAt === room.time) continue;
    const { target, distance } = nearest(e, living);
    if (!target) continue;
    if (e.kind === "healer" && room.time >= e.abilityAt) {
      e.abilityAt = room.time + 4;
      let healed = 0;
      for (const ally of room.enemies) {
        if (ally === e || ally.guardian || ally.hp <= 0 || ally.hp >= ally.maxHp || gap(e, ally) > 105) continue;
        heal(ally, .10); ally.healFlashUntil = room.time + .4;
        if (++healed >= 3) break;
      }
    }
    const stop = e.kind === "caster" ? 175 : e.kind === "healer" ? 100 : e.r + 12;
    if (!e.aim && distance > stop) {
      const step = Math.min(distance - stop, e.speed * room.players[0].combat.jigongSlowFactor(e) * dt);
      e.x += (target.x - e.x) * step / distance; e.y += (target.y - e.y) * step / distance;
    }
    // Separate crowds before testing contact, so moved enemies cannot hit from the old position.
    const ix = Math.floor(e.x / 104), iy = Math.floor(e.y / 104);
    for (let j = iy - 1; j <= iy + 1; j++) for (let i = ix - 1; i <= ix + 1; i++) {
      for (const other of grid.get(i + j * 64) ?? []) {
        const min = (e.r + other.r) * .77, dx = e.x - other.x, dy = e.y - other.y, d = Math.hypot(dx, dy);
        if (d >= min) continue;
        const x = d ? dx / d : 1, y = d ? dy / d : 0, push = (min - d) * .34;
        if (!e.guardian) Object.assign(e, from(e.x + x * push, e.y + y * push));
        if (!other.guardian) Object.assign(other, from(other.x - x * push, other.y - y * push));
      }
    }
    const cell = ix + iy * 64;
    if (!grid.has(cell)) grid.set(cell, []);
    grid.get(cell).push(e);
  }
  for (const e of room.enemies) {
    if (e.hp <= 0 || e.stun > 0 || e.knockedBackAt === room.time) { e.contact.clear(); continue; }
    for (const p of living) {
      if (!available(p) || gap(p, e) > e.r + 16) e.contact.delete(p.id);
      else if (room.time >= (e.contact.get(p.id) ?? 0)) {
        hurt(room, p, enemyAttack(room, e)); e.contact.set(p.id, room.time + .5);
      }
    }
  }
}
function area(room, marks, name, duration, damage) {
  room.warnings.push({ marks, name, start: room.time, until: room.time + duration, damage });
}
function advanceBolts(room, living, dt) {
  room.bolts = room.bolts.filter(shot => {
    const step = Math.min(dt, shot.life), sx = shot.dx * shot.speed * step, sy = shot.dy * shot.speed * step;
    for (const p of living) {
      if (!available(p)) continue;
      const x = shot.x - p.prevX, y = shot.y - p.prevY;
      const vx = sx - (p.x - p.prevX) * step / dt, vy = sy - (p.y - p.prevY) * step / dt;
      const t = clamp(-(x * vx + y * vy) / (vx * vx + vy * vy || 1), 0, 1);
      if ((x + vx * t) ** 2 + (y + vy * t) ** 2 > (shot.r + 12) ** 2) continue;
      hurt(room, p, shot.damage); return false;
    }
    shot.x += sx; shot.y += sy; shot.life -= dt;
    return shot.life > 0 && shot.x >= 0 && shot.y >= 0 && shot.x <= width && shot.y <= height;
  });
}
function enemyCasts(room, living, dt) {
  advanceBolts(room, living, dt);
  room.warnings = room.warnings.filter(warning => {
    if (room.time < warning.until) return true;
    for (const p of living) if (warning.marks.some(mark => gap(p, mark) < mark.r)) hurt(room, p, warning.damage);
    for (const mark of warning.marks) room.sparks.push({ ...mark, life: .32, kind: "enemy-impact" });
    return false;
  });
  let active = room.bolts.length, choice;
  for (const e of room.enemies) {
    if (e.hp <= 0 || e.stun > 0 || e.knockedBackAt === room.time) {
      if (e.aim) { e.aim = null; e.rangedReadyAt = room.time + .85; }
      continue;
    }
    if (e.guardian) {
      if (room.time < e.castAt || !living.length) continue;
      const p = living[e.cast % living.length], pressure = clamp((room.time - e.start - 25) / 50, 0, 1);
      e.castAt = room.time + e.interval * (1 - .25 * pressure);
      if (room.floor) {
        const cast = R.towerCast(room.floor, e.cast++, e, p);
        area(room, cast.marks, cast.name, cast.duration, enemyAttack(room, e) * cast.power);
      } else {
        const spread = e.at === 480 ? 3 : e.at === 300 ? 2 : 1;
        const marks = Array.from({ length: spread }, (_, i) => ({
          ...from(p.x + (i - (spread - 1) / 2) * 76, p.y + (i % 2 ? 52 : 0)), r: spread === 3 ? 57 : 48
        }));
        e.cast++; area(room, marks, e.name, 1.25, enemyAttack(room, e));
      }
      continue;
    }
    if (e.aim) {
      if (room.time < e.aim.until) { active++; continue; }
      const aim = e.aim;
      e.aim = null; e.rangedReadyAt = room.time + aim.profile.recovery + room.random() * .65;
      const { profile, dx, dy } = aim;
      if (profile.seal) {
        for (const p of living) if (gap(p, aim) < profile.radius) hurt(room, p, e.attack * profile.power);
        room.sparks.push({ x: aim.x, y: aim.y, r: profile.radius, life: .32, kind: "enemy-impact" });
      } else {
        room.bolts.push({ x: e.x + dx * 12, y: e.y + dy * 12, dx, dy,
          speed: profile.speed, r: profile.radius, life: (profile.range + 24) / profile.speed, damage: e.attack * profile.power });
        active++;
      }
    } else if (room.time >= room.nextAim && room.time >= e.rangedReadyAt && (!choice || e.rangedReadyAt < choice.e.rangedReadyAt)) {
      const profile = R.rangedAttacks[e.mini ? "mini" : e.kind], { target, distance } = nearest(e, living);
      if (target && distance <= profile.range) choice = { e, profile, target };
    }
  }
  const cap = room.boss ? 2 : room.floor ? 4 : room.storyTime < 60 ? 1 : room.storyTime < 180 ? 2 : 3;
  if (!choice || active >= cap + (living.length - 1)) return;
  const { e, profile, target } = choice;
  const d = gap(e, target);
  room.nextAim = room.time + (room.storyTime < 60 ? 1 : .65);
  e.aim = { x: target.x, y: target.y, dx: d ? (target.x - e.x) / d : 1, dy: d ? (target.y - e.y) / d : 0, profile,
    start: room.time, until: room.time + profile.windup };
}

function detonate(room, p, limit) {
  const targets = room.enemies.filter(e => e.hp > 0 && !e.guardian && !e.mini);
  for (let i = 0; i < Math.min(limit, targets.length); i++) {
    const random = i + Math.floor(room.random() * (targets.length - i));
    [targets[i], targets[random]] = [targets[random], targets[i]];
    targets[i].hp = 0;
  }
  room.sparks.push({ x: p.x, y: p.y, r: 300, life: .4, kind: "bomb" });
}
function collect(room, living, dt, now) {
  const magnets = new Set();
  room.loot = room.loot.filter(item => {
    const p = item.magnet && available(item.magnet) ? item.magnet : nearest(item, living).target;
    if (!p || (!item.magnet && gap(item, p) >= 96)) return true;
    const d = gap(item, p), reach = item.magnet ? 1100 : item.kind === "xp" ? 330 : 240;
    if (d > 23 + reach * dt) {
      item.x += (p.x - item.x) * reach * dt / d; item.y += (p.y - item.y) * reach * dt / d;
      return true;
    }
    if (item.kind === "xp") {
      for (const member of room.players) if (withinGrace(member, now)) addXP(room, member, item.value);
    } else if (item.kind === "heal") heal(p, .10);
    else if (item.kind === "bomb") detonate(room, p, 20);
    else magnets.add(p);
    return false;
  });
  for (const p of magnets) {
    room.sparks.push({ x: p.x, y: p.y, r: 96, life: .65, kind: "magnet" });
    for (const item of room.loot) item.magnet ??= p;
  }
}
function dropItem(room, e) {
  const roll = room.random();
  const kind = roll < .075 ? "heal" : roll < .10 ? "magnet" : roll < .15 ? "bomb" : null;
  if (kind) room.loot.push({ x: e.x + 20, y: e.y, kind });
}
function enterFloor(room, now) {
  room.floor++; room.floorKills = 0; room.floorTime = 0; room.nextSpawn = room.time + 3;
  room.graceUntil = room.nextSpawn; room.nextAim = room.time;
  if (room.floor === R.towerBaselineFloor) room.baseline = combatBalance(room);
  room.enemies = []; room.bolts = []; room.warnings = []; room.sparks = [];
  // Bank remaining shared XP while transitioning; rewards use the curve for the floor that dropped them.
  room.loot = [];
  for (const p of room.players) {
    p.enteredTower ||= withinGrace(p, now);
    p.combat.reset(); p.revive = 0;
    for (const skill of p.jigong) skill.castAt = null;
    Object.assign(p, from(width / 2 + (p === room.players[0] ? -1 : 1) * 40, height / 2));
    heal(p, .25);
  }
}
function settle(room, now) {
  let guardian, normalKills = 0;
  room.enemies = room.enemies.filter(e => {
    if (e.hp > 0) return true;
    room.kills++;
    if (e.guardian) { guardian = e; return false; }
    if (room.floor) room.floorKills++;
    if (e.mini) {
      for (const p of room.players) if (withinGrace(p, now)) p.gearRewards++;
      if (room.random() < .30) room.miniThreshold += 10;
    } else normalKills++;
    if (room.kills <= 5 || e.mini || room.random() < .90) {
      const seconds = room.baseline?.time ?? (room.floor ? R.storyDuration + room.towerTime : room.storyTime);
      room.loot.push({ x: e.x, y: e.y, kind: "xp", value: R.enemyXP(seconds, room.floor, e.mini) });
    }
    dropItem(room, e);
    return false;
  });
  if (guardian) {
    room.boss = null; room.warnings = []; room.bolts = [];
    const nextFloor = room.floor || guardian.at === R.storyDuration;
    const remainingXP = nextFloor ? room.loot.reduce((sum, item) => sum + (item.kind === "xp" ? item.value : 0), 0) : 0;
    for (const p of room.players) {
      if (!withinGrace(p, now)) continue;
      addXP(room, p, (guardian.xp ?? 0) + remainingXP);
      if (room.floor) {
        p.creditedFloor = room.floor; p.creditedKills = room.kills;
        if (!p.skillTome && room.random() < .005) {
          p.skillTome = true;
          if (p.reward?.title === "升級強化") p.reward = null;
        }
      }
    }
    if (room.floor) room.cleared = room.floor;
    if (nextFloor) enterFloor(room, now);
    else dropItem(room, guardian);
    return;
  }
  // Keep long sessions bounded even if players leave experience on the ground.
  if (room.loot.length > 1200) {
    const overflow = room.loot.splice(0, room.loot.length - 1200);
    const xp = overflow.reduce((sum, item) => sum + (item.kind === "xp" ? item.value : 0), 0);
    if (xp) for (const p of room.players) if (withinGrace(p, now)) addXP(room, p, xp);
  }
  room.miniKills += normalKills;
  while (room.miniKills >= room.miniThreshold) {
    room.miniKills -= room.miniThreshold;
    const living = room.players.filter(available);
    if (!room.boss && living.length && (room.floor || room.enemies.length < 105) && room.random() < .30) {
      spawnMob(room, living[Math.floor(room.random() * living.length)], combatBalance(room), false, null, true);
    }
  }
}
function tick(room, dt, now = Date.now()) {
  if ((room.vacantAt !== null && now - room.vacantAt >= graceMs) ||
    (room.state === "waiting" && now - room.createdAt >= 5 * 60_000)) room.state = "closed";
  if (room.state !== "live" || room.vacantAt !== null) return;
  const living = room.players.filter(available);
  if (!living.length) {
    if (room.players.every(p => p.hp <= 0 || !withinGrace(p, now))) room.state = "lost";
    return;
  }
  room.time += dt;
  if (!room.boss) {
    if (room.floor) { room.floorTime += dt; room.towerTime += dt; }
    else {
      const nextAt = R.bossStages[room.nextBoss]?.at ?? R.storyDuration;
      room.storyTime = Math.min(nextAt, room.storyTime + dt);
    }
  }
  movePlayers(room, living, dt);
  spawns(room, living);
  playerAttacks(room, dt);
  moveEnemies(room, living, dt);
  enemyCasts(room, living.filter(available), dt);
  if (room.players.every(p => p.hp <= 0 || !withinGrace(p, now))) { room.state = "lost"; return; }
  reviveTeam(room, dt);
  collect(room, room.players.filter(available), dt, now);
  settle(room, now);
  room.sparks = room.sparks.filter(s => (s.life -= dt) > 0);
  for (const p of room.players) refreshReward(room, p);
}

function pendingReward(p) {
  return p?.reward && available(p) ? {
    id: p.reward.id, title: p.reward.title, remaining: p.pendingLevels + p.gearRewards,
    options: p.reward.options.map(({ label, apply, learn }, id) => ({
      id, label, enabled: Boolean(apply || learn !== undefined)
    }))
  } : null;
}
function snapshot(room) {
  const effects = [];
  const bolts = room.bolts.map(({ x, y, r }) => ({ x, y, r, hostile: true }));
  for (const p of room.players) {
    const { targetedBolts, shots, jigongShots, jigongWindCasts, bricks, ingots } = p.combat.effects();
    for (const { x, y } of targetedBolts) bolts.push({ x, y, r: 5 });
    for (const s of shots) if (s.lag <= 0) effects.push({ x: s.x, y: s.y, kind: s.fire ? "fire-ring" : "ring", r: 10 });
    for (const s of jigongShots) effects.push({ x: s.x, y: s.y, kind: ["shoe", "water", "wind"][s.index], r: s.r, angle: s.angle });
    for (const { x, y } of bricks) effects.push({ x, y, kind: "brick", r: 10 });
    for (const { x, y } of ingots) effects.push({ x, y, kind: "ingot", r: 16 });
    for (const cast of jigongWindCasts) for (const { x, y } of cast.eyes) effects.push({ x, y, kind: "eye", r: R.jigongWindRadius });
    if (available(p)) for (let i = 0; i < p.wheels; i++) {
      const theta = p.wheelAngle + i * 2 * Math.PI / p.wheels;
      effects.push({ x: p.x + Math.cos(theta) * R.wheelOrbitRadius, y: p.y + Math.sin(theta) * R.wheelOrbitRadius,
        r: R.wheelHitRadius * (p.evolved[1] ? R.wheelEvolutionScale : 1), kind: p.evolved[1] ? "fire-wheel" : "wheel" });
    }
  }
  return {
    state: room.state, width, height, stage: Math.min(3, Math.floor(room.storyTime / 150) + 1),
    time: Math.floor(room.time), storyTime: Math.floor(room.storyTime + 1e-8), kills: room.kills,
    floor: room.floor, cleared: room.cleared, stageKills: room.floorKills, goal: room.floor ? R.towerGoal : 480,
    transitioning: room.time < room.graceUntil, reviveRadius, bolts,
    players: room.players.map(p => ({
      id: p.id, name: p.name, character: p.character, x: p.x, y: p.y, hp: Math.ceil(p.hp), maxHp: p.maxHp,
      xp: p.xp, needed: R.levelCost(p.level + 1, Boolean(room.floor)), level: p.level, connected: p.connected,
      revive: p.revive / reviveSeconds, protected: room.time < p.safeUntil, tome: p.skillTome,
      moving: Boolean(p.dx || p.dy), facing: p.facing, attackFacing: p.attackFacing,
      attacking: p.attackUntil > room.time, attackAge: room.time - p.attackAt
    })),
    enemies: room.enemies.map(e => ({
      id: e.id, x: e.x, y: e.y, hp: Math.ceil(e.hp), maxHp: e.maxHp, radius: e.r, guardian: Boolean(e.guardian),
      name: e.name, kind: e.mini ? "mini" : e.kind, color: e.color, flash: e.flash > 0, phase: e.phase,
      healed: e.healFlashUntil > room.time, aim: e.aim ? { dx: e.aim.dx, dy: e.aim.dy, range: e.aim.profile.range,
        ...(e.aim.profile.seal ? { seal: { x: e.aim.x, y: e.aim.y, r: e.aim.profile.radius } } : {}),
        charge: clamp((room.time - e.aim.start) / (e.aim.until - e.aim.start), 0, 1) } : null
    })),
    warnings: room.warnings.map(({ marks, start, until, name }) => ({
      marks, name, charge: clamp((room.time - start) / (until - start), 0, 1)
    })),
    loot: room.loot.map(({ x, y, kind, magnet }) => ({ x: Math.round(x), y: Math.round(y), kind, ...(magnet ? { magnet: true } : {}) })),
    effects, sparks: room.sparks.slice(-90)
  };
}

module.exports = { createRoom, connect, disconnect, setInput, chooseReward, pendingReward, tick, snapshot, graceMs, reviveRadius };

const R = require("../../lib/nezha/assets/battle-rules.js");
const Combat = require("../../lib/nezha/assets/battle-combat.js");
const width = 2880, height = 2160;
const graceMs = 90_000, reviveRadius = 96, reviveSeconds = 3;
const lootRules = R.loot;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const available = p => p.connected && p.hp > 0;
const withinGrace = (p, now) => !p.retired && (p.connected || (p.disconnectedAt !== null && now - p.disconnectedAt <= graceMs));
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
    floor: 0, floorTime: 0, towerTime: 0, floorKills: 0, floorMiniKills: 0, nextTowerMiniAt: 0, cleared: 0, kills: 0, graceUntil: 0,
    createdAt: now, vacantAt: now, nextId: 1, nextSpawn: .35, nextAim: 0, miniKills: 0, miniThreshold: 50,
    enemies: [], bolts: [], warnings: [], loot: [], sparks: [], boss: null, random,
    magnetFlights: [], magnetPulses: [], bombBursts: [], pickupNotice: null, lootUntil: null,
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
  if (!p || p.retired || room.state === "closed" || (p.disconnectedAt !== null && !withinGrace(p, now))) return false;
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
function retirePlayer(room, id, now = Date.now()) {
  const p = room.players.find(item => item.id === id);
  if (!p?.connected) return;
  disconnect(room, id, now);
  p.retired = true;
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
  if (!available(p) || room.time < p.safeUntil || R.relicShield(p)) return;
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
    room.sparks.push({ x: p.x, y: p.y, r: 52, life: .65, kind: "revive" });
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
  const tower = R.towerStrength(room.floor);
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
  room.enemies.push({ ...stats, speed: stats.speed * R.towerMoveFactor(room.floor),
    ...origin(room, p, mini ? 185 : 305 + room.random() * (wave ? 160 : 66), angle),
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
    r: room.floor ? 49 : guardian.r, speed: (guardian.speed + floor * 2) * R.towerMoveFactor(room.floor), hp, maxHp: hp, attack,
    name: room.floor ? "第 " + room.floor + " 層・" + guardian.name : guardian.name,
    start: room.time, castAt: room.time + 2, cast: 0, flash: 0, stun: 0, contact: new Map(), wheels: new Map() };
  room.enemies.push(room.boss);
}
function spawns(room, living) {
  if (room.boss || room.time < room.graceUntil) return;
  const objective = R.towerObjective(room.floor);
  if (room.floor ? (objective.mini ? room.floorMiniKills : room.floorKills) >= objective.goal
    : R.bossStages[room.nextBoss]?.at <= room.storyTime + 1e-8) {
    spawnBoss(room, living[Math.floor(room.random() * living.length)]); return;
  }
  const crowd = room.floor ? R.towerCrowd(room.floor, room.floorTime, true) : null;
  const cap = crowd?.cap ?? 105;
  const balance = combatBalance(room);
  if (objective.mini && room.time >= room.nextTowerMiniAt) {
    const count = R.towerMiniWave(room.floor, room.floorMiniKills, room.enemies.filter(e => e.mini && e.hp > 0).length);
    for (let i = 0; i < count; i++) spawnMob(room, living[(room.nextId + i) % living.length], balance, false, null, true);
    room.nextTowerMiniAt = room.time + R.towerMiniInterval;
  }
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
    const batch = crowd ? crowd.batch
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
    p.wheelTimer = Math.max(0, p.wheelTimer - dt);
    if (!active || !p.wheels) continue;
    const flaming = p.evolved[1], radius = R.wheelHitRadius * (flaming ? R.wheelEvolutionScale : 1);
    for (const e of room.enemies) {
      if (e.hp <= 0 || room.time < (e.wheels.get(p.id) ?? 0) || !combat.wheelSweepsEnemy(e, start, sweep, radius)) continue;
      p.wheelTimer = R.relicCooldown(p, R.wheelCooldown);
      e.wheels.set(p.id, room.time + p.wheelTimer); combat.wheelStrike(e, p.wheelDamage);
      if (room.time >= p.attackUntil + .14) combat.poseForAttack(e);
      if (flaming && e.hp > 0 && !R.isPetrified(e, room.time) && room.time >= (e.wheelKnockback ?? 0)) {
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
    if (e.hp <= 0 || e.stun > 0 || e.knockedBackAt === room.time || R.isPetrified(e, room.time)) continue;
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
    if (!e.aim && !e.special && distance > stop) {
      const step = Math.min(distance - stop, e.speed * room.players[0].combat.jigongSlowFactor(e) * dt);
      e.x += (target.x - e.x) * step / distance; e.y += (target.y - e.y) * step / distance;
      if (Math.abs((target.x - e.x) / distance) > .08) e.facing = Math.sign(target.x - e.x);
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
    if (e.hp <= 0 || e.stun > 0 || e.special || e.knockedBackAt === room.time || R.isPetrified(e, room.time)) { e.contact.clear(); continue; }
    for (const p of living) {
      if (!available(p) || gap(p, e) > e.r + 16) e.contact.delete(p.id);
      else if (room.time >= (e.contact.get(p.id) ?? 0)) {
        hurt(room, p, enemyAttack(room, e)); e.contact.set(p.id, room.time + .5);
      }
    }
  }
}
function area(room, marks, name, duration, damage, pattern) {
  room.warnings.push({ marks, name, start: room.time, until: room.time + duration, damage, pattern });
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
function towerSpecial(room, boss, living) {
  const lane = boss.special;
  if (room.time < lane.readyAt) return;
  if (lane.pattern === "qi") {
    room.bolts.push(...R.fireTowerQi(lane));
    room.sparks.push({ x: lane.x, y: lane.y, r: 43, life: .32, kind: "boss-area", pattern: "qi" });
    boss.special = null;
    return;
  }
  lane.phase = "dash";
  const step = R.towerDashStep(lane, boss, room.time);
  for (const p of living) {
    if (lane.hit.has(p.id) || !available(p) || room.time < p.safeUntil) continue;
    if (R.sweptHit(step.fromX, step.fromY, step.x, step.y, p.prevX, p.prevY, p.x, p.y, lane.r)) {
      lane.hit.add(p.id); hurt(room, p, lane.damage);
    }
  }
  if (!lane.trailAt || room.time >= lane.trailAt) {
    room.sparks.push({ x: step.fromX, y: step.fromY, r: boss.r, angle: lane.angle, life: .24, kind: "boss-dash" });
    lane.trailAt = room.time + .06;
  }
  if (step.done) boss.special = null;
}
function enemyCasts(room, living, dt) {
  advanceBolts(room, living, dt);
  if (room.boss?.hp <= 0) room.warnings = [];
  room.warnings = room.warnings.filter(warning => {
    if (room.time < warning.until) return true;
    for (const p of living) if (warning.marks.some(mark => gap(p, mark) < mark.r)) hurt(room, p, warning.damage);
    for (const mark of warning.marks) room.sparks.push({ ...mark, life: .32,
      kind: warning.pattern ? "boss-area" : "enemy-impact", pattern: warning.pattern });
    return false;
  });
  let active = room.bolts.length, choice;
  for (const e of room.enemies) {
    if (e.hp <= 0 || e.stun > 0 || e.knockedBackAt === room.time || R.isPetrified(e, room.time)) {
      if (e.aim) { e.aim = null; e.rangedReadyAt = room.time + .85; }
      if (e.special) e.special = null;
      continue;
    }
    if (e.guardian) {
      if (e.special) { towerSpecial(room, e, living); continue; }
      if (room.time < e.castAt || !living.length) continue;
      const p = living[e.cast % living.length], pressure = clamp((room.time - e.start - 25) / 50, 0, 1);
      e.castAt = room.time + e.interval * (1 - .25 * pressure);
      if (room.floor) {
        const cast = R.towerCast(room.floor, e.cast++, e, p);
        const damage = enemyAttack(room, e) * cast.power;
        if (cast.marks.length) area(room, cast.marks, cast.name, cast.duration, damage, cast.pattern);
        else {
          e.special = { ...R.towerLane(cast, e, p, width, height, room.time, damage), hit: new Set() };
          e.facing = Math.cos(e.special.angle) < 0 ? -1 : 1;
          e.castAt += .4;
        }
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

function detonate(room, p, count) {
  const targets = room.enemies.filter(e => e.hp > 0 && !e.guardian);
  const limit = Math.min(count * lootRules.bombKillLimit, targets.length);
  for (let i = 0; i < limit; i++) {
    const random = i + Math.floor(room.random() * (targets.length - i));
    [targets[i], targets[random]] = [targets[random], targets[i]];
    targets[i].hp = 0;
    room.sparks.push({ x: targets[i].x, y: targets[i].y, r: 8, life: .28, kind: "bomb-hit" });
  }
  room.sparks.push({ x: p.x, y: p.y, r: 36, life: lootRules.bombFlashTime, kind: "bomb" });
  room.pickupNotice = { kind: "bomb", count: limit, until: room.time + 1.5 };
}
function sharedXP(room, amount, now) {
  if (amount > 0) for (const p of room.players) if (withinGrace(p, now)) addXP(room, p, amount);
}
function healTeam(room, count, now) {
  if (!count) return;
  for (const p of room.players) {
    if (!withinGrace(p, now) || p.hp <= 0) continue;
    const before = p.hp;
    heal(p, lootRules.healFraction * count);
    if (p.hp > before) room.sparks.push({ x: p.x, y: p.y, r: 32, life: .55, kind: "heal" });
  }
  room.pickupNotice = { kind: "heal", until: room.time + 1.25 };
}
function activateMagnet(room, player, now) {
  const stride = Math.max(1, Math.ceil(room.loot.length / lootRules.maxMagnetFlights));
  let xp = 0, potions = 0, bombs = 0, arrival = 0;
  room.loot.forEach((item, i) => {
    if (R.isTowerRelic(item.kind)) return;
    const duration = R.magnetFlightDuration(gap(item, player));
    if (item.kind === "xp") xp += item.value;
    if (item.kind === "heal") potions++;
    if (item.kind === "bomb") { bombs++; arrival = Math.max(arrival, duration); }
    if (i % stride === 0 || item.kind === "bomb") {
      room.magnetFlights.push({ x: Math.round(item.x), y: Math.round(item.y), kind: item.kind,
        target: player.id, startedAt: Math.round(room.time * 1000) / 1000, duration: Math.round(duration * 1000) / 1000 });
    }
  });
  room.loot = room.loot.filter(item => R.isTowerRelic(item.kind));
  room.magnetFlights = room.magnetFlights.slice(-lootRules.maxMagnetFlights);
  room.magnetPulses.push({ target: player.id, startedAt: room.time });
  if (bombs) room.bombBursts.push({ player, count: bombs, at: room.time + arrival });
  sharedXP(room, xp, now);
  healTeam(room, potions, now);
  room.pickupNotice = { kind: "magnet", until: room.time + 1.25 };
}
function collect(room, living, dt, now) {
  let magnet, relicPickup, xp = 0, potions = 0;
  const bombs = new Map();
  room.loot = room.loot.filter(item => {
    const { target: p, distance } = nearest(item, living);
    if (R.isTowerRelic(item.kind)) {
      if (!p || distance > R.tomePickupRadius) return true;
      for (const teammate of room.players.filter(member => withinGrace(member, now))) {
        if (R.grantRelic(teammate, item.kind) && item.kind === "tome" && teammate.reward?.title === "升級強化") teammate.reward = null;
      }
      relicPickup = { kind: item.kind, until: room.time + 2.4 };
      room.sparks.push({ x: item.x, y: item.y, life: 1.4, r: 32, kind: "relic-pickup", relic: item.kind });
      return false;
    }
    if (!p || distance >= lootRules.radius) return true;
    const step = Math.min(distance, (item.kind === "xp" ? 330 : 240) * dt);
    if (distance - step >= (item.kind === "xp" ? 22 : 25)) {
      item.x += (p.x - item.x) * step / distance; item.y += (p.y - item.y) * step / distance;
      return true;
    }
    if (item.kind === "xp") xp += item.value;
    else if (item.kind === "heal") potions++;
    else if (item.kind === "bomb") bombs.set(p, (bombs.get(p) ?? 0) + 1);
    else magnet ??= p;
    return false;
  });
  sharedXP(room, xp, now);
  healTeam(room, potions, now);
  for (const [p, count] of bombs) detonate(room, p, count);
  if (magnet) activateMagnet(room, magnet, now);
  const leaving = room.boss?.hp <= 0 && (room.floor || room.boss.at === R.storyDuration);
  room.bombBursts = room.bombBursts.filter(burst => {
    if (!leaving && room.time + 1e-8 < burst.at) return true;
    detonate(room, burst.player, burst.count); return false;
  });
  room.magnetPulses = room.magnetPulses.filter(pulse => room.time - pulse.startedAt < lootRules.magnetPulseTime);
  room.magnetFlights = room.magnetFlights.filter(flight => room.time - flight.startedAt < flight.duration);
  if (relicPickup) room.pickupNotice = relicPickup;
}
function dropItem(room, e) {
  const kind = R.lootKind(room.random());
  if (kind) room.loot.push({ id: room.nextId++, x: e.x + 20, y: e.y, kind });
}
function enterFloor(room, now) {
  const first = room.floor === 0;
  room.floor++; room.floorKills = 0; room.floorMiniKills = 0; room.floorTime = 0;
  room.nextSpawn = room.time + (first ? 3 : .65); room.nextTowerMiniAt = room.time + .8;
  room.lootUntil = null;
  room.graceUntil = room.nextSpawn; room.nextAim = room.time;
  if (room.floor === R.towerBaselineFloor) room.baseline = combatBalance(room);
  room.enemies = []; room.bolts = []; room.warnings = []; room.sparks = [];
  // Bank remaining shared XP while transitioning; rewards use the curve for the floor that dropped them.
  room.loot = [];
  room.magnetFlights = []; room.magnetPulses = []; room.bombBursts = []; room.pickupNotice = null;
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
      if (room.floor) room.floorMiniKills++;
      for (const p of room.players) if (withinGrace(p, now)) p.gearRewards++;
      if (room.floor < R.miniTowerFloor && room.random() < .30) room.miniThreshold += 10;
    } else normalKills++;
    if (room.kills <= 5 || e.mini || room.random() < .90) {
      const seconds = room.baseline?.time ?? (room.floor ? R.storyDuration + room.towerTime : room.storyTime);
      room.loot.push({ id: room.nextId++, x: e.x, y: e.y, kind: "xp", value: R.enemyXP(seconds, room.floor, e.mini) });
    }
    dropItem(room, e);
    return false;
  });
  if (guardian) {
    room.boss = null; room.warnings = []; room.bolts = [];
    const firstFloor = !room.floor && guardian.at === R.storyDuration;
    const remainingXP = firstFloor ? room.loot.reduce((sum, item) => sum + (item.kind === "xp" ? item.value : 0), 0) : 0;
    for (const p of room.players) {
      if (!withinGrace(p, now)) continue;
      addXP(room, p, (guardian.xp ?? 0) + remainingXP);
      if (room.floor) {
        p.creditedFloor = room.floor; p.creditedKills = room.kills;
      }
    }
    if (room.floor) {
      room.cleared = room.floor;
      room.lootUntil = room.time + R.towerLootSeconds;
      const team = room.players.filter(p => withinGrace(p, now));
      for (const item of R.towerRelicDrops(team, room.floor, guardian, width, height, room.random)) {
        room.loot.push({ ...item, id: room.nextId++ });
      }
      room.enemies = [];
      for (const p of room.players) p.combat.reset();
      dropItem(room, guardian);
    } else if (firstFloor) enterFloor(room, now);
    else {
      dropItem(room, guardian);
      room.sparks.push({ x: guardian.x, y: guardian.y, r: 30, life: 1.2, value: guardian.xp, kind: "boss-xp" });
    }
    return;
  }
  // Keep long sessions bounded even if players leave experience on the ground.
  if (room.loot.length > 1200) {
    const overflow = room.loot.splice(0, room.loot.length - 1200);
    const xp = overflow.reduce((sum, item) => sum + (item.kind === "xp" ? item.value : 0), 0);
    sharedXP(room, xp, now);
  }
  if (room.floor < R.miniTowerFloor) room.miniKills += normalKills;
  while (room.floor < R.miniTowerFloor && room.miniKills >= room.miniThreshold) {
    room.miniKills -= room.miniThreshold;
    const living = room.players.filter(available);
    if (!room.boss && living.length && (room.floor || room.enemies.length < 105) && room.random() < .30) {
      spawnMob(room, living[Math.floor(room.random() * living.length)], combatBalance(room), false, null, true);
    }
  }
}
const lootState = room => R.towerLootState(room.lootUntil - room.time, room.loot.some(item => item.kind === "tome"),
  room.loot.some(item => item.kind !== "tome" && R.isTowerRelic(item.kind)));
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
  if (room.lootUntil !== null) {
    movePlayers(room, living, dt);
    reviveTeam(room, dt);
    collect(room, room.players.filter(available), dt, now);
    room.sparks = room.sparks.filter(s => (s.life -= dt) > 0);
    for (const p of room.players) refreshReward(room, p);
    if (lootState(room)) return;
    // Preserve unclaimed shared XP using the cleared floor's level curve.
    sharedXP(room, room.loot.reduce((sum, item) => sum + (item.kind === "xp" ? item.value : 0), 0), now);
    enterFloor(room, now);
    return;
  }
  if (!room.boss) {
    if (room.floor) { room.floorTime += dt; room.towerTime += dt; }
    else {
      const nextAt = R.bossStages[room.nextBoss]?.at ?? R.storyDuration;
      room.storyTime = Math.min(nextAt, room.storyTime + dt);
    }
  }
  movePlayers(room, living, dt);
  spawns(room, living);
  let stoneTriggered = false;
  for (const p of room.players) if (withinGrace(p, now)) R.advanceRelics(p, dt, (kind, duration) => {
    if (kind === "stone") {
      if (stoneTriggered) return;
      R.petrifyEnemies(room.enemies, room.time, duration);
      stoneTriggered = true;
    }
    if (available(p)) room.sparks.push({ x: p.x, y: p.y, life: .5, r: 40, kind: "relic-" + kind });
  });
  playerAttacks(room, dt);
  if (room.floor && room.boss?.hp <= 0) {
    settle(room, now);
    for (const p of room.players) refreshReward(room, p);
    return;
  }
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
  const bolts = room.bolts.map(({ x, y, r, dx, dy, style }) => ({ x, y, r, dx, dy, style, hostile: true }));
  const relicTarget = room.loot.find(item => R.isTowerRelic(item.kind));
  const lootBreak = room.lootUntil === null ? null : lootState(room);
  const lane = room.boss?.special;
  for (const p of room.players) {
    const { targetedBolts, shots, jigongShots, jigongWindCasts, bricks, ingots } = p.combat.effects();
    for (const { x, y, angle, basePower } of targetedBolts) bolts.push({ x, y, r: 5, angle, ...(basePower !== null ? { ingot: true } : {}) });
    for (const s of shots) if (s.lag <= 0) effects.push({ x: s.x, y: s.y, kind: s.fire ? "fire-ring" : "ring", r: 10, angle: s.angle });
    for (const { x, y, index, r, angle, age, evolved, returning } of jigongShots) effects.push({
      x, y, kind: ["shoe", "water", "wind"][index], index, r, angle, age, evolved, returning
    });
    for (const brick of bricks) effects.push({ ...brick, kind: "brick", r: 10 });
    for (const { x, y } of ingots) effects.push({ x, y, kind: "ingot", r: 16 });
    for (const cast of jigongWindCasts) for (const { x, y } of cast.eyes) {
      effects.push({ x, y, kind: "eye", r: R.jigongWindRadius, startedAt: cast.startedAt });
    }
    if (available(p)) for (let i = 0; i < p.wheels; i++) {
      effects.push({ ...R.wheelPoint(p, i),
        r: R.wheelHitRadius * (p.evolved[1] ? R.wheelEvolutionScale : 1), kind: p.evolved[1] ? "fire-wheel" : "wheel" });
    }
  }
  return {
    state: room.state, width, height, stage: Math.min(3, Math.floor(room.storyTime / 150) + 1),
    time: Math.floor(room.time), clock: Math.round(room.time * 1000) / 1000, storyTime: Math.floor(room.storyTime + 1e-8),
    nextWave: room.nextWave, kills: room.kills,
    floor: room.floor, cleared: room.cleared, stageKills: room.floorKills, stageMiniKills: room.floorMiniKills,
    goal: room.floor ? R.towerObjective(room.floor).goal : R.storyDuration,
    transitioning: room.time < room.graceUntil, reviveRadius, bolts, lootBreak,
    tomeTarget: relicTarget ? { x: relicTarget.x, y: relicTarget.y, kind: relicTarget.kind } : null,
    bossLane: lane ? { pattern: lane.pattern, name: lane.name, x: lane.x, y: lane.y, angle: lane.angle, length: lane.length,
      r: lane.r, phase: lane.phase, charge: clamp((room.time-lane.started)/(lane.readyAt-lane.started), 0, 1) } : null,
    players: room.players.map(p => ({
      id: p.id, name: p.name, character: p.character, x: p.x, y: p.y, hp: Math.ceil(p.hp), maxHp: p.maxHp,
      xp: p.xp, needed: R.levelCost(p.level + 1, Boolean(room.floor)), level: p.level, connected: p.connected,
      attack: p.attack, defense: p.defense, speed: p.speed, gear: p.gear, skillLevels: p.skillLevels,
      evolved: p.evolved, skillTome: p.skillTome, relics: p.relics, qi: p.qi, ringTimer: p.ringTimer, wheelTimer: p.wheelTimer, brickTimer: p.brickTimer,
      jigong: p.jigong.map(({ cooldown, timer }) => ({ cooldown, timer })),
      revive: p.revive / reviveSeconds, protected: room.time < p.safeUntil, tome: p.skillTome,
      moving: Boolean(p.dx || p.dy), facing: p.facing, attackFacing: p.attackFacing,
      attacking: p.attackUntil > room.time, attackAge: room.time - p.attackAt
    })),
    enemies: room.enemies.map(e => ({
      id: e.id, x: e.x, y: e.y, hp: Math.ceil(e.hp), maxHp: e.maxHp, radius: e.r, guardian: Boolean(e.guardian),
      name: e.name, kind: e.mini ? "mini" : e.kind, color: e.color, flash: e.flash > 0, phase: e.phase, facing: e.facing,
      ...(e.guardian ? { casting: Boolean(e.special) || e.castAt - room.time < .28, pressure: clamp((room.time - e.start - 25) / 50, 0, 1) } : {}),
      ...(e.stun > 0 ? { stun: true } : {}), petrifiedUntil: e.petrifiedUntil, jigongSlowUntil: e.jigongSlowUntil, jigongWaterUntil: e.jigongWaterUntil,
      healFlashUntil: e.healFlashUntil, aim: e.aim ? { dx: e.aim.dx, dy: e.aim.dy, range: e.aim.profile.range + 24 + Math.min(12, e.r),
        ...(e.aim.profile.seal ? { seal: { x: e.aim.x, y: e.aim.y, r: e.aim.profile.radius } } : {}),
        charge: clamp((room.time - e.aim.start) / (e.aim.until - e.aim.start), 0, 1) } : null
    })),
    warnings: room.warnings.map(({ marks, start, until, name, pattern }) => ({
      marks, name, pattern, charge: clamp((room.time - start) / (until - start), 0, 1)
    })),
    loot: room.loot.map(({ id, x, y, kind }) => ({ id, x: Math.round(x), y: Math.round(y), kind })),
    magnetFlights: room.magnetFlights, magnetPulses: room.magnetPulses,
    pickupNotice: room.pickupNotice?.until > room.time ? room.pickupNotice : null,
    effects, sparks: room.sparks.slice(-90)
  };
}

module.exports = { createRoom, connect, disconnect, retirePlayer, setInput, chooseReward, pendingReward, tick, snapshot, graceMs, reviveRadius };

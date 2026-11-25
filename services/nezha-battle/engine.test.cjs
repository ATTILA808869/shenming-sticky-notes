const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createRoom, connect, disconnect, retirePlayer, setInput, chooseReward, pendingReward, tick, snapshot, graceMs, reviveRadius } = require("./engine.cjs");
const { signResult } = require("./server.cjs");
const R = require("../../lib/nezha/assets/battle-rules.js");
const team = [{ id: "leader", name: "Leader", character: "nezha" }, { id: "guest", name: "Guest", character: "jigong" }];
const step = (room, frames = 1) => {
  for (let i = 0; i < frames; i++) tick(room, .05, room.time * 1000 + 50);
};
function live(random = () => .50) {
  const room = createRoom(team, 0, random);
  connect(room, "leader", 0);
  connect(room, "guest", 0);
  return room;
}

test("one authoritative room, independent movement, and 90-second reconnect", () => {
  const room = createRoom(team, 1000, () => .5);
  assert.equal(connect(room, "other", 1000), false);
  assert.equal(connect(room, "leader", 1000), true);
  tick(room, .05, 1050);
  assert.equal(room.time, 0);
  assert.equal(connect(room, "guest", 1100), true);
  const [a, b] = room.players, start = a.x, bx = b.x;
  setInput(room, "leader", 5, 0);
  tick(room, .05, 1150);
  assert.equal(a.x, start + 210 * .05);
  assert.equal(b.x, bx);
  disconnect(room, "leader", 1200);
  tick(room, .05, 1250);
  assert.equal(a.x, start + 210 * .05);
  assert.equal(connect(room, "leader", 1200 + graceMs - 1), true);
  disconnect(room, "leader", 100_000);
  assert.equal(connect(room, "leader", 100_000 + graceMs + 1), false);
});

test("story waits for all three scheduled bosses, then uses the same endless tower floor objective", () => {
  const room = live();
  let receivedXP = 0;
  for (const [index, expected] of R.bossStages.entries()) {
    room.storyTime = expected.at - .1;
    step(room);
    assert.equal(room.boss, null);
    step(room);
    assert.equal(room.boss.name, expected.name);
    assert.equal(room.floor, 0);
    for (const p of room.players) p.safeUntil = room.time + 3;
    room.boss.hp = 0;
    step(room);
    receivedXP += expected.xp;
    const [a, b] = room.players;
    let xp = a.xp;
    for (let level = 2; level <= a.level; level++) xp += R.levelCost(level);
    assert.equal(xp, receivedXP);
    assert.equal(a.level, b.level);
    assert.equal(a.pendingLevels, a.level - 1);
    if (index < 2) assert.equal(room.floor, 0);
  }
  assert.equal(room.floor, 1);
  assert.equal(snapshot(room).goal, 1000);
  assert.equal(signResult("fixture", room.players[0]).split(".").length, 2);
  room.time = room.graceUntil + .05;
  room.floorKills = 999; room.kills = 1002;
  step(room);
  assert.equal(room.boss, null);
  room.floorKills++; room.kills++;
  step(room);
  assert.equal(room.boss.kind, "dragon");
  room.boss.hp = 0;
  step(room);
  assert.equal(room.floor, 1);
  assert.deepEqual(snapshot(room).lootBreak, { seconds: 5, tome: false });
  step(room, 99);
  assert.equal(room.floor, 1);
  step(room);
  assert.equal(room.floor, 2);
  assert.equal(room.cleared, 1);
  assert.deepEqual(room.players.map(p => [p.creditedFloor, p.creditedKills]), [[1, 1004], [1, 1004]]);
  assert.equal(room.state, "live");
});

test("boss XP queues individual upgrades and each upgrade can be selected only once", () => {
  const room = live(), [a, b] = room.players;
  room.storyTime = 120;
  step(room);
  room.boss.hp = 0;
  step(room);
  const aOffer = pendingReward(a), bOffer = pendingReward(b);
  assert.equal(a.level, 11);
  assert.equal(aOffer.options.length, 8);
  assert.equal(aOffer.remaining, 10);
  assert.equal(chooseReward(room, a.id, bOffer.id, 0), false);
  assert.equal(chooseReward(room, a.id, aOffer.id, 4), true);
  const pattern = pendingReward(a);
  assert.equal(pattern.options.length, 3);
  assert.equal(chooseReward(room, a.id, pattern.id, 2), true);
  const route = pendingReward(a);
  assert.equal(chooseReward(room, a.id, route.id, 1), true);
  assert.equal(chooseReward(room, a.id, route.id, 1), false);
  assert.deepEqual([a.pattern, a.rings, a.pendingLevels], [2, 1, 9]);
  assert.equal(a.skillRoutes[0], "damage");
  assert.equal(bOffer.id, pendingReward(b).id);
  const second = pendingReward(a).options.find(x => x.label.startsWith("超級風火輪"));
  assert.equal(chooseReward(room, a.id, pendingReward(a).id, second.id), true);
  assert.equal(chooseReward(room, a.id, pendingReward(a).id, 2), true);
  assert.equal(pendingReward(a).options.length, 7);
});

test("tower guardian rolls 15% per relic for the team, waits for pickups, and shares them", () => {
  assert.equal(R.rollSkillTome({ skillTome: false }, 0, () => 0), false);
  assert.equal(R.rollSkillTome({ skillTome: true }, 1, () => 0), false);
  assert.equal(R.rollSkillTome({ skillTome: false }, 1, () => .15), false);
  assert.equal(R.rollSkillTome({ skillTome: false }, 1, () => .149999), true);
  const room = live(), [a, b] = room.players;
  room.nextSpawn = Infinity;
  room.floor = 1;
  room.floorKills = R.towerGoal;
  step(room);
  room.boss.hp = 0;
  const rolls = [.149, .15, .14, .15, .15];
  let randomCalls = 0;
  room.random = () => { randomCalls++; return rolls.shift() ?? .99; };
  step(room);
  const tome = room.loot.find(item => item.kind === "tome");
  const bell = room.loot.find(item => item.kind === "bell");
  assert.deepEqual(room.loot.filter(item => R.isTowerRelic(item.kind)).map(item => item.kind), ["tome", "bell"]);
  assert.equal(randomCalls, 6); // Five relic rolls and the guardian's ordinary drop roll.
  assert.deepEqual([a.skillTome, b.skillTome], [false, false]);
  assert.equal(room.cleared, 1);
  assert.deepEqual(snapshot(room).lootBreak, { seconds: 5, tome: true, relic: true });
  room.loot.push({ kind: "magnet", x: a.x, y: a.y });
  step(room, 101);
  assert.equal(room.floor, 1);
  assert.deepEqual(snapshot(room).lootBreak, { seconds: 0, tome: true, relic: true });
  assert.equal(a.skillTome, false);
  assert.ok(room.loot.includes(tome));
  b.x = tome.x; b.y = tome.y;
  step(room);
  assert.deepEqual([a.skillTome, b.skillTome], [true, true]);
  assert.equal(room.floor, 1);
  assert.deepEqual(snapshot(room).lootBreak, { seconds: 0, tome: false, relic: true });
  a.hp = 0;
  b.x = bell.x; b.y = bell.y;
  step(room);
  assert.deepEqual(room.players.map(p => p.relics.bell), [{ remaining: 50, active: 0 }, { remaining: 50, active: 0 }]);
  assert.equal(room.floor, 2);
  assert.equal(snapshot(room).lootBreak, null);
});

test("retiring from a scored round frees the teammate and prevents future credits for the departing player", () => {
  const room = live(), [a, b] = room.players;
  room.floor = room.cleared = a.creditedFloor = b.creditedFloor = 1;
  room.lootUntil = room.time;
  const tome = { kind: "tome", x: 900, y: 900 };
  room.loot.push(tome);
  retirePlayer(room, a.id, 0);
  assert.equal(connect(room, a.id, 0), false);
  assert.equal(a.creditedFloor, 1);
  assert.ok(room.loot.includes(tome)); // The pickup belongs to the team, not the departed player.
  b.x = tome.x; b.y = tome.y;
  step(room);
  assert.equal(room.floor, 2);
  assert.equal(b.connected, true);
  assert.equal(room.state, "live");
});

test("mini reward provides only four gears; solo rules still enforce health and movement caps", () => {
  const room = live(), [a, b] = room.players;
  a.gearRewards = 1;
  a.maxHp = 1000; a.hp = 100; a.speed = 100;
  step(room);
  const offer = pendingReward(a);
  assert.equal(offer.options.length, 4);
  assert.equal(offer.options[1].enabled, false);
  assert.equal(chooseReward(room, a.id, offer.id, 1), false);
  assert.equal(chooseReward(room, a.id, offer.id, 3), true);
  assert.equal(a.hp, 700);
  assert.equal(a.maxHp, 1000);
  assert.equal(pendingReward(b), null);
  assert.deepEqual([2, 20, 21, 41, 50, 51].map(n => R.levelCost(n)), [5, 185, 795, 2855, 599, 599]);
  assert.equal(R.levelCost(50, true), R.levelCost(80, true));
});

test("sword and armor raise their per-pick bonuses at each independent fifteen-rank threshold", () => {
  const p = R.createCharacter("nezha");
  for (const [rank, sword, armor] of [[1, 4, 9], [14, 4, 9], [15, 6, 14], [29, 6, 14], [30, 8, 19], [45, 10, 24]]) {
    p.gear[3] = p.gear[1] = rank - 1;
    const attack = p.attack, defense = p.defense;
    const picks = R.gearChoices(p);
    assert.equal(picks[0].label, "神刀 Lv." + rank + "・攻擊力＋" + sword);
    assert.equal(picks[2].label, "神甲 Lv." + rank + "・防禦力＋" + armor);
    picks[0].apply(); picks[2].apply();
    assert.deepEqual([p.gear[3], p.gear[1], p.attack - attack, p.defense - defense], [rank, rank, sword, armor]);
  }
  const room = live(), [a, b] = room.players;
  a.gear[3] = 14; b.gear[1] = 29; a.gearRewards = b.gearRewards = 1;
  step(room);
  assert.equal(chooseReward(room, a.id, pendingReward(a).id, 0), true);
  assert.equal(chooseReward(room, b.id, pendingReward(b).id, 2), true);
  assert.equal(a.attack, 31);
  assert.equal(b.defense, 44);
});

test("every tenth character level multiplies total attack and defense by 1.10 after normal gains", () => {
  const p = R.createCharacter("nezha");
  R.gearChoices(p)[0].apply(); R.gearChoices(p)[2].apply();
  while (p.level < 9) R.gainLevel(p);
  assert.deepEqual([p.attack, p.defense], [45, 42]);
  R.gainLevel(p);
  assert.deepEqual([p.attack.toFixed(2), p.defense.toFixed(2)], ["51.70", "47.30"]);
  while (p.level < 20) R.gainLevel(p);
  assert.deepEqual([p.attack.toFixed(2), p.defense.toFixed(2)], ["78.87", "63.03"]);
});

test("rescue progresses only with a connected nearby teammate and restores 30% of max HP", () => {
  const room = live(), [a, b] = room.players;
  a.hp = 0; a.maxHp = 200; a.gearRewards = 1; room.nextSpawn = Infinity;
  step(room, 15);
  assert.equal(a.revive, 0);
  b.x = a.x + reviveRadius - 10;
  step(room, 30);
  assert.ok(snapshot(room).players[0].revive > .45);
  assert.equal(pendingReward(a), null);
  b.x = a.x + reviveRadius + 10;
  step(room);
  assert.equal(a.revive, 0);
  b.x = a.x;
  step(room, 59);
  assert.equal(a.hp, 0);
  step(room);
  assert.equal(a.hp, 60);
  assert.ok(snapshot(room).players[0].protected);
  a.hp = b.hp = 0;
  step(room);
  assert.equal(room.state, "lost");
});

test("tower bosses cycle six telegraphed attacks without overlapping-cast damage", () => {
  for (let floor = 1; floor <= 6; floor++) {
    const names = new Set();
    for (let i = 0; i < 6; i++) {
      const attack = R.towerCast(floor, i, { x: 900, y: 900, r: 49 }, { x: 1050, y: 900 });
      if (attack.marks.length) assert.ok(attack.duration >= 1.4 && attack.marks.length >= 4);
      names.add(attack.pattern);
    }
    assert.deepEqual(names, new Set(["meteor", "ring", "line", "cross", "dash", "qi"]));
  }
  const room = live(), [a, b] = room.players;
  room.nextSpawn = Infinity;
  room.warnings.push({ start: 0, until: .05, damage: 25, marks: [{ ...a, r: 20 }, { ...a, r: 20 }] });
  step(room);
  assert.equal(a.hp, 80);
  assert.equal(b.hp, 100);
});

test("tower guardians repeat the four beast models without changing floor-by-floor move and cast pacing", () => {
  const sprites = ["qinglong", "zhuque", "baihu", "xuanwu"];
  const names = ["魔化青龍", "魔化朱雀", "魔化白虎", "魔化玄武"];
  for (let floor = 1; floor <= 8; floor++) {
    const room = live(), beast = (floor - 1) % sprites.length;
    room.floor = floor; room.floorKills = R.towerObjective(floor).goal;
    step(room);
    const guardian = snapshot(room).enemies.find(enemy => enemy.guardian);
    assert.equal(guardian.towerSprite, sprites[beast]);
    assert.equal(guardian.name, "第 " + floor + " 層・" + names[beast]);
    assert.equal(room.boss.interval, [2.65, 2.5, 2.85][(floor - 1) % 3]);
    assert.equal(room.boss.speed, ([95, 114, 83][(floor - 1) % 3] + Math.min(floor, R.towerBaselineFloor) * 2) * R.towerMoveFactor(floor));
  }
});

function bossFixture(pattern) {
  const room = live(), [a, b] = room.players;
  room.floor = 1; room.floorKills = R.towerGoal;
  step(room);
  const boss = room.boss;
  boss.x = 1000; boss.y = 1000; boss.castAt = room.time;
  boss.cast = Array.from({ length: 6 }, (_, i) => R.towerCast(1, i, boss, a).pattern).indexOf(pattern);
  a.x = 1240; a.y = 1000; a.qi.timer = b.qi.timer = 30;
  b.x = 1240; b.y = 1000;
  step(room);
  b.y = 1350;
  return { room, a, b, boss };
}
test("tower area attacks expose charge, strike, recovery and hit phases to both clients", () => {
  const { room, boss } = bossFixture("meteor");
  const pose = () => R.towerGuardianPose(snapshot(room).enemies.find(enemy => enemy.guardian), room.time);
  assert.equal(pose(), 1);
  assert.equal(snapshot(room).enemies.find(enemy => enemy.guardian).castFacing, 1);
  step(room, 32);
  assert.equal(pose(), 2);
  step(room, 4);
  assert.equal(pose(), 3);
  boss.flash = .15;
  assert.equal(pose(), 4);
  boss.petrifiedUntil = room.time + .12;
  assert.equal(pose(), 0);
  step(room, 5);
  assert.equal(pose(), 0);
});

test("dash warns along a fixed lane, hits at most once, and can be dodged", () => {
  const { room, a, b, boss } = bossFixture("dash");
  const lane = snapshot(room).bossLane;
  assert.equal(lane.phase, "charge");
  assert.equal(lane.angle, 0);
  step(room, 18);
  assert.equal(boss.x, lane.x);
  assert.equal(a.hp, 100);
  assert.equal(R.towerGuardianPose(boss, room.time), 1);
  step(room, 8);
  assert.equal(R.towerGuardianPose(boss, room.time), 2);
  step(room, 6);
  assert.equal(a.hp, 100 - R.hitValue(boss.attack * 1.10, a.defense));
  assert.equal(b.hp, 100);
  for (let i = 0; boss.special && i < 4; i++) step(room);
  assert.equal(boss.x, lane.x + lane.length);
  assert.equal(snapshot(room).bossLane, null);
  const nearWall = R.towerLane({ pattern: "dash", duration: 1 }, { x: 2830, y: 800, r: 49 }, { x: 2900, y: 800 }, 2880, 2160, 0, 5);
  assert.equal(nearWall.length, 20);
});
test("boss qi telegraphs three shots, travels, and is interrupted by stun", () => {
  const { room, a, b } = bossFixture("qi");
  assert.equal(snapshot(room).bossLane.pattern, "qi");
  step(room, 19);
  assert.equal(room.bolts.filter(shot => shot.style === "tower-qi").length, 3);
  assert.equal(a.hp, 100);
  step(room, 15);
  assert.ok(a.hp < 100);
  assert.equal(b.hp, 100);
  const interrupted = bossFixture("qi");
  interrupted.boss.stun = 1.2;
  step(interrupted.room, 20);
  assert.equal(snapshot(interrupted.room).bossLane, null);
  assert.equal(interrupted.room.bolts.length, 0);
});

test("shared combat hits with actual character attack; nearby collected XP benefits both teammates", () => {
  const room = live();
  for (const p of room.players) p.safeUntil = 10;
  step(room, 110);
  assert.ok(room.kills > 0);
  assert.equal(room.players[0].level, room.players[1].level);
  assert.equal(room.players[0].xp, room.players[1].xp);
  const combat = room.players[0].combat, p = room.players[0];
  p.attack = 52; p.qi.timer = 0;
  const enemy = { x: p.x + 30, y: p.y, r: 12, hp: 100 };
  combat.frame(p, room.time, 2880, 2160, null, []);
  combat.updateSkills(.05, [enemy]);
  assert.equal(enemy.hp, 48);
});

test("telegraphed caster seals track a fixed position and can be dodged or interrupted", () => {
  for (const interrupted of [false, true]) {
    const room = live(), [p, ally] = room.players;
    const previousHp = p.hp;
    room.nextSpawn = Infinity;
    ally.y += 400;
    p.qi.timer = 9; ally.qi.timer = 9;
    const caster = { ...R.mobStats("caster", R.enemyBalance(p, 350, false)), x: p.x + 220, y: p.y,
      id: 101, flash: 0, stun: 0, contact: new Map(), wheels: new Map(), rangedReadyAt: 0 };
    room.enemies.push(caster);
    step(room);
    const seal = snapshot(room).enemies[0].aim.seal;
    assert.equal(seal.x, p.x);
    assert.equal(seal.y, p.y);
    if (interrupted) caster.stun = 3;
    else setInput(room, p.id, 0, 1);
    step(room, 24);
    assert.equal(p.hp, previousHp);
    if (interrupted) assert.equal(room.sparks.length, 0);
  }
});

test("tower health and damage grow 25% per floor on the fixed baseline", () => {
  const testBoss = floor => {
    const room = live();
    room.floor = floor; room.floorKills = R.towerObjective(floor).goal;
    room.baseline = R.enemyBalance(room.players[0], R.storyDuration, true);
    step(room);
    return room.boss;
  };
  const four = testBoss(4), five = testBoss(5), six = testBoss(6);
  assert.equal(R.towerHealthBoost, 2.7);
  assert.equal(R.towerStrength(2), 1.25);
  assert.ok(Math.abs(five.maxHp - four.maxHp * 1.25) <= 1);
  assert.ok(Math.abs(six.maxHp - five.maxHp * 1.25) <= 1);
  assert.ok(Math.abs(five.attack / four.attack - 1.25) < 1e-9);
  assert.ok(Math.abs(six.attack / five.attack - 1.25) < 1e-9);
  assert.ok(five.speed > four.speed);
  assert.ok(R.towerCrowd(20, 0, true).cap > R.towerCrowd(1, 0, true).cap);
});

test("floor 20 requires mini bosses instead of ordinary kills and spawns the last required mini", () => {
  assert.deepEqual(R.towerObjective(1), { mini: false, goal: 1000 });
  assert.deepEqual(R.towerObjective(19), { mini: false, goal: 1900 });
  assert.deepEqual(R.towerObjective(21), { mini: true, goal: 101 });
  const room = live();
  room.floor = 20; room.floorKills = 3000; room.floorMiniKills = 99; room.nextSpawn = Infinity;
  step(room);
  assert.equal(room.boss, null);
  assert.equal(snapshot(room).goal, 100);
  assert.equal(snapshot(room).stageMiniKills, 99);
  assert.equal(room.enemies.length, 1);
  assert.equal(room.enemies[0].mini, true);
  room.enemies[0].hp = 0;
  step(room, 2);
  assert.equal(room.floorMiniKills, 100);
  assert.ok(room.boss?.guardian);
});

test("shared bell and stone trigger together and block damage and enemy actions", () => {
  const room = live(), [a, b] = room.players;
  room.floor = 1;
  step(room, 8);
  room.nextSpawn = Infinity;
  const enemy = room.enemies[0];
  enemy.x = a.x; enemy.y = a.y;
  for (const kind of ["bell", "stone"]) room.loot.push({ kind, x: b.x, y: b.y });
  step(room);
  for (const p of room.players) for (const kind of ["bell", "stone"]) p.relics[kind].remaining = .05;
  for (const p of room.players) p.qi.timer = 100;
  const hp = a.hp, x = enemy.x, y = enemy.y;
  step(room);
  assert.deepEqual(room.players.map(R.relicShield), [true, true]);
  assert.equal(R.isPetrified(enemy, room.time), true);
  step(room, 19);
  assert.deepEqual([enemy.x, enemy.y, a.hp], [x, y, hp]);
  step(room, 2);
  assert.equal(R.isPetrified(enemy, room.time), false);
  assert.equal(a.hp, hp);
  step(room, 41);
  assert.deepEqual(room.players.map(R.relicShield), [false, false]);
  step(room, 3);
  assert.ok(a.hp < hp);
});

test("shared hourglass does not reduce basic qi cooldown, and sword echoes once at 30 percent", () => {
  const p = R.createCharacter("nezha"), random = [ .2999, .30 ];
  const combat = require("../../lib/nezha/assets/battle-combat.js").create(R, () => random.shift());
  p.ringTimer = 2; p.qi.timer = .5;
  assert.equal(R.grantRelic(p, "hourglass"), true);
  assert.equal(R.grantRelic(p, "hourglass"), false);
  assert.equal(p.ringTimer, 1.4);
  assert.equal(p.qi.timer, .5);
  R.grantRelic(p, "sword");
  const enemy = { x: 0, y: 0, hp: 100 };
  combat.frame(p, 0, 100, 100, null, []);
  combat.wheelStrike(enemy, 10);
  assert.equal(enemy.hp, 80);
  combat.wheelStrike(enemy, 10);
  assert.equal(enemy.hp, 70);
});

test("Jigong casts every learned relic and evolved wind, but cannot start another volley when down", () => {
  const room = live(), p = room.players[1];
  p.skillTome = true;
  for (let i = 0; i < 3; i++) assert.equal(R.learnSkill(p, i, 0, "damage"), true);
  p.skillLevels[2] = 10; p.gear[3] = 1; R.applyEvolutions(p);
  const target = { hp: 10000, r: 18, x: p.x + 200, y: p.y }, combat = p.combat;
  combat.frame(p, .05, 2880, 2160, null, []);
  combat.updateSkills(.05, [target]);
  combat.frame(p, .16, 2880, 2160, null, []);
  combat.updateSkills(.05, [target]);
  const shots = combat.effects().jigongShots;
  assert.deepEqual([0, 1, 2].map(i => shots.filter(s => s.index === i).length), [8, 4, 3]);
  assert.equal(combat.effects().jigongWindCasts[0].eyes.length, 10);
  combat.reset();
  p.jigong[0].castAt = .2;
  combat.frame(p, .21, 2880, 2160, null, []);
  combat.updateSkills(.05, [target], false);
  assert.equal(combat.effects().jigongShots.length, 0);
});

test("a contested pickup credits XP once per teammate and healing is synchronized without reviving", () => {
  const room = live(), [a, b] = room.players;
  room.nextSpawn = Infinity;
  b.x = a.x; b.y = a.y;
  a.hp = 40; b.maxHp = 200; b.hp = 50;
  room.loot.push({ id: 991, x: a.x, y: a.y, kind: "xp", value: 14 });
  room.loot.push({ id: 992, x: a.x, y: a.y, kind: "heal" });
  step(room, 3);
  assert.deepEqual(room.players.map(p => [p.level, p.xp, p.hp]), [[2, 9, 50], [2, 9, 70]]);
  assert.equal(room.loot.length, 0);
  assert.equal(snapshot(room).sparks.filter(s => s.kind === "heal").length, 2);
  b.hp = 0;
  room.loot.push({ id: 993, x: a.x, y: a.y, kind: "heal" });
  step(room);
  assert.equal(a.hp, 60);
  assert.equal(b.hp, 0);
});

test("one magnet pulls every pickup type for both players and remote bombs use the normal kill credits", () => {
  const room = live(() => 0), [a, b] = room.players;
  room.nextSpawn = Infinity; room.storyTime = 120;
  for (const p of room.players) { p.hp = 50; p.qi.timer = 9; }
  step(room);
  const boss = room.boss;
  for (let i = 0; i < 24; i++) {
    room.enemies.push({ id: 200 + i, x: 240, y: 200 + i * 40, hp: 100, maxHp: 100, attack: 8, r: 13,
      speed: 0, kind: "shade", mini: i === 0, stun: 0, flash: 0, contact: new Map(), wheels: new Map(), rangedReadyAt: Infinity });
  }
  b.x = 2000; b.y = 1500;
  room.loot.push({ id: 1000, x: a.x, y: a.y, kind: "magnet" },
    { id: 1001, x: 100, y: 100, kind: "xp", value: 19 },
    { id: 1002, x: 200, y: 100, kind: "heal" },
    { id: 1003, x: 300, y: 100, kind: "bomb" },
    { id: 1004, x: 400, y: 100, kind: "magnet" });
  step(room);
  const first = snapshot(room);
  assert.deepEqual(first.players.map(p => [p.xp, p.hp]), [[14, 60], [14, 60]]);
  assert.equal(first.loot.length, 0);
  assert.equal(first.magnetPulses.length, 1);
  assert.deepEqual(first.magnetFlights.map(f => [f.kind, f.target]), [["xp", a.id], ["heal", a.id], ["bomb", a.id], ["magnet", a.id]]);
  assert.equal(first.kills, 0);
  step(room, 18);
  const after = snapshot(room);
  assert.equal(after.kills, 20);
  assert.equal(after.magnetFlights.length, 0);
  assert.equal(after.pickupNotice.kind, "bomb");
  assert.equal(after.pickupNotice.count, 20);
  assert.equal(room.boss, boss);
  assert.ok(boss.hp > 0);
  assert.deepEqual(room.players.map(p => p.gearRewards), [1, 1]);
});

test("both players can walk out of each other's view without a shared-camera tether", () => {
  const room = live(), [a, b] = room.players;
  room.nextSpawn = Infinity;
  setInput(room, a.id, -1, 0); setInput(room, b.id, 1, 0);
  step(room, 100);
  const state = snapshot(room);
  assert.ok(state.players[1].x - state.players[0].x > 2000);
  assert.equal(state.state, "live");
});

test("the shared HUD receives the wheel cooldown without sending legacy flame trails", () => {
  const room = live(), [p, ally] = room.players;
  room.nextSpawn = Infinity;
  p.qi.timer = ally.qi.timer = 10;
  p.wheels = 1; p.evolved[1] = true;
  room.enemies.push({ x: p.x + R.wheelOrbitRadius, y: p.y, id: 712, r: 13, hp: 100, maxHp: 100,
    speed: 0, attack: 8, kind: "shade", stun: 0, flash: 0, contact: new Map(), wheels: new Map(), rangedReadyAt: Infinity });
  step(room);
  assert.equal(snapshot(room).players[0].wheelTimer, R.wheelCooldown);
  assert.ok(snapshot(room).effects.some(e => e.kind === "fire-wheel"));
  assert.ok(snapshot(room).effects.every(e => e.kind !== "wheel-trail"));
  step(room);
  assert.ok(snapshot(room).players[0].wheelTimer < R.wheelCooldown);
});

test("co-op sends each wheel's orbital direction even when two wheels share one player", () => {
  const room = live(), [p] = room.players;
  p.x = 600; p.y = 400; p.wheels = 2; p.evolved[1] = true;
  p.wheelAngle = Math.PI / 2;
  const wheels = snapshot(room).effects.filter(e => e.kind === "fire-wheel");
  assert.deepEqual(wheels.map(e => e.orbitAngle), [Math.PI / 2, 3 * Math.PI / 2]);
  assert.deepEqual(wheels.map(e => [Math.round(e.x), Math.round(e.y)]), [[600, 496], [600, 304]]);
});

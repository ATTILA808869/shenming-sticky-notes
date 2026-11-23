const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createRoom, connect, disconnect, setInput, chooseReward, pendingReward, tick, snapshot, graceMs, reviveRadius } = require("./engine.cjs");
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

test("tower bosses cycle four telegraphed distinct wide attacks without overlapping-cast damage", () => {
  for (let floor = 1; floor <= 6; floor++) {
    const names = new Set();
    for (let i = 0; i < 4; i++) {
      const attack = R.towerCast(floor, i, { x: 900, y: 900 }, { x: 1050, y: 900 });
      assert.ok(attack.duration >= 1.4 && attack.marks.length >= 4);
      names.add(attack.name);
    }
    assert.equal(names.size, 4);
  }
  const room = live(), [a, b] = room.players;
  room.nextSpawn = Infinity;
  room.warnings.push({ start: 0, until: .05, damage: 25, marks: [{ ...a, r: 20 }, { ...a, r: 20 }] });
  step(room);
  assert.equal(a.hp, 80);
  assert.equal(b.hp, 100);
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

test("tower health and damage scale 15% per floor starting with floor five", () => {
  const testBoss = floor => {
    const room = live();
    room.floor = floor; room.floorKills = R.towerGoal;
    room.baseline = R.enemyBalance(room.players[0], R.storyDuration, true);
    step(room);
    return room.boss;
  };
  const four = testBoss(4), five = testBoss(5), six = testBoss(6);
  assert.ok(Math.abs(five.maxHp - four.maxHp * 1.15) <= 1);
  assert.ok(Math.abs(six.maxHp - five.maxHp * 1.15) <= 1);
  assert.ok(Math.abs(five.attack / four.attack - 1.15) < 1e-9);
  assert.ok(Math.abs(six.attack / five.attack - 1.15) < 1e-9);
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

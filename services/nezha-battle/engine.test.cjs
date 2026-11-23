const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createRoom, connect, disconnect, setInput, tick, snapshot, graceMs } = require("./engine.cjs");
const team = [{ id: "leader", name: "Leader", character: "nezha" }, { id: "guest", name: "Guest", character: "jigong" }];

test("the same server room controls movement for two players and retains their seat", () => {
  const room = createRoom(team, 1000, () => 0);
  assert.equal(connect(room, "other", 1000), false);
  assert.equal(connect(room, "leader", 1000), true);
  tick(room, .05, 1050);
  assert.equal(room.time, 0);
  assert.equal(connect(room, "guest", 1100), true);
  setInput(room, "leader", 5, 0);
  tick(room, .05, 1150);
  assert.equal(room.players[0].x, 468 + 177 * .05);
  assert.equal(room.players[1].x, 572);
  disconnect(room, "leader", 1200);
  tick(room, .05, 1250);
  assert.equal(room.players[0].x, 468 + 177 * .05);
  assert.equal(room.state, "live");
  assert.equal(connect(room, "leader", 1200 + graceMs - 1), true);
  disconnect(room, "leader", 100_000);
  assert.equal(connect(room, "leader", 100_000 + graceMs + 1), false);
});

test("both players share all guardian kills and the final victory", () => {
  const room = createRoom(team, 0, () => 0);
  connect(room, "leader", 0);
  connect(room, "guest", 0);
  const guardians = new Set();
  for (let step = 1; step <= 4000 && room.state === "live"; step++) {
    tick(room, .05, 50 * step);
    for (const enemy of room.enemies) if (enemy.guardian) guardians.add(enemy.name);
  }
  const state = snapshot(room);
  assert.equal(guardians.size, 3);
  assert.equal(state.state, "won");
  assert.equal(state.stage, 3);
  assert.ok(state.kills >= 39);
  assert.equal(state.players[0].xp, state.players[1].xp);
});

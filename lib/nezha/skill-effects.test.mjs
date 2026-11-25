import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const assets = new URL("./assets/", import.meta.url);
const source = name => readFileSync(new URL(name, assets), "utf8");

function fixture(ready = true) {
  const calls = [], requests = [];
  class Image {
    constructor() {
      this.complete = ready;
      this.naturalWidth = ready ? 5632 : 0;
      requests.push(this);
    }
  }
  const context = vm.createContext({ Image });
  vm.runInContext(["battle-rules.js", "skill-effects.js", "enemy-art.js"].map(source).join("\n"), context);
  const sprites = vm.runInContext("NezhaSkillArt", context);
  const ctx = {
    save() {}, restore() {}, beginPath() {}, closePath() {}, lineTo() {}, fill() {}, stroke() {}, clearRect() {},
    arc() { calls.push(["legacy circle"]); }, fillRect() { calls.push(["legacy rectangle"]); },
    translate(...args) { calls.push(["translate", ...args]); },
    rotate(angle) { calls.push(["rotate", angle]); },
    drawImage(image, ...args) { calls.push(["image", image.src, ...args]); }
  };
  const render = vm.runInContext("NezhaCombatArt", context).create(ctx);
  const world = vm.runInContext("NezhaWorldArt", context);
  return { calls, requests, sprites, ctx, render, world };
}

test("gold coin, bomb, magnet and peach use the new transparent pickup sprites", () => {
  const { calls, ctx, world } = fixture();
  world.gem(ctx, 16, 16);
  for (const kind of ["bomb", "magnet", "heal"]) world.drop(ctx, 24, 24, kind);
  const files = ["xp", "bomb", "magnet", "heal"];
  assert.deepEqual(calls.map(call => call[1]), files.map(kind => "/games/nezha/loot-" + kind + ".png"));
  for (const kind of [...files.map(value => "loot-" + value), "tower-sword", "tower-bell", "tower-hourglass", "tower-stone"]) {
    const png = readFileSync(new URL(kind + ".png", assets));
    assert.equal(png.readUInt32BE(16), 192);
    assert.equal(png.readUInt32BE(20), 192);
    assert.equal(png[25], 6);
  }
});

test("terrain reuses cached tile patterns and keeps only the lanterns animated", () => {
  const terrain = [], painted = [];
  const document = { createElement() {
    const tile = { getContext: () => ({ fillRect: (...rect) => painted.push(rect) }) };
    terrain.push(tile);
    return tile;
  }};
  const context = vm.createContext({ document });
  vm.runInContext(source("enemy-art.js"), context);
  const world = vm.runInContext("NezhaWorldArt", context);
  const draws = [], patterns = [];
  const ctx = {
    strokeRect() {},
    createPattern(image, mode) { patterns.push({ image, mode }); return patterns.at(-1); },
    fillRect(...rect) { draws.push([this.fillStyle, ...rect]); }
  };
  const view = { x: 1250, y: 910, width: 400, height: 450 };
  world.background(ctx, view, 2880, 2160, 0);
  assert.equal(terrain.length, 2);
  assert.ok(terrain.every(tile => tile.width === 912 && tile.height === 608));
  assert.deepEqual(draws.slice(1, 4), [
    [patterns[0], 1250, 910, 400, 450], [patterns[1], 1296, 910, 336, 450], [patterns[1], 1250, 992, 400, 192]
  ]);
  const construction = painted.length;
  draws.length = 0;
  world.background(ctx, view, 2880, 2160, .2);
  assert.equal(patterns.length, 2);
  assert.equal(painted.length, construction);
  assert.equal(draws.filter(([style]) => patterns.includes(style)).length, 3);
  assert.ok(draws.length < 160);
  assert.equal(world.visibleIn(view, { x: 1240, y: 1000 }, 10), true);
  assert.equal(world.visibleIn(view, { x: 1239, y: 1000 }, 10), false);
});

test("co-op smoothing only interpolates nearby movement within the same active floor", () => {
  const context = vm.createContext({});
  vm.runInContext(source("battle-ui.js"), context);
  const { battleMotion, smoothBattleActor } = vm.runInContext("NezhaUi", context);
  const player = { id: "p", x: 40, y: 70, connected: true };
  const previous = { state: "live", floor: 2, clock: 10, players: [{ ...player, x: 10 }], enemies: [] };
  const next = { ...previous, clock: 10.05, players: [player] };
  const motion = battleMotion(previous, next);
  assert.equal(smoothBattleActor(player, motion, .5).x, 25);
  assert.equal(smoothBattleActor(player, motion, 1), player);
  const dash = { ...player, towerMotion: "dash" }, teleport = { ...player, x: 180 }, offline = { ...player, connected: false };
  for (const actor of [dash, teleport, offline]) assert.equal(smoothBattleActor(actor, motion, .5), actor);
  assert.equal(battleMotion(previous, { ...next, floor: 3 }), null);
  assert.equal(battleMotion(previous, { ...next, transitioning: true }), null);
});

test("all five tower relic markers fit on a narrow phone at zoomed-out scale", () => {
  const context = vm.createContext({});
  vm.runInContext(source("battle-ui.js"), context);
  const { layoutRelicDrops } = vm.runInContext("NezhaUi", context);
  const targets = ["tome", "sword", "bell", "hourglass", "stone"].map((kind, index) => ({ kind, x: 320 + 60 * index, y: 500 }));
  const view = { width: 312, height: 520, scale: .32, offsetX: 0, offsetY: 115 };
  const markers = layoutRelicDrops(targets, view, { x: 400, y: 460 });
  for (const [i, relic] of markers.entries()) {
    assert.equal(relic.onScreen, true);
    const { x, y } = relic.marker;
    assert.ok(x >= 41 && x <= view.width - 41 && y >= 0 && y + 70 <= view.height);
    assert.ok(markers.slice(0, i).every(({ marker: p }) => Math.abs(p.x - x) >= 82 || Math.abs(p.y - y) >= 70));
  }
  const distant = layoutRelicDrops(targets, { ...view, scale: 1, offsetX: -1250 }, { x: 1406, y: 500 });
  assert.equal(distant.filter(item => item.marker).length, 1);
  assert.equal(distant.find(item => item.marker).kind, "stone");
  assert.ok(distant.every(item => !item.onScreen && item.angle < 0));
});

test("match gesture guard blocks page drag and pinch without swallowing taps or panel scroll", () => {
  const context = vm.createContext({});
  vm.runInContext(source("battle-ui.js"), context);
  const { mountBattleGestures } = vm.runInContext("NezhaUi", context);
  const classes = new Set(), handlers = new Map();
  const enable = mountBattleGestures({
    documentElement: { classList: {
      contains: name => classes.has(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name)
    } },
    addEventListener: (name, handler, options) => handlers.set(name, { handler, options })
  });
  const zone = { scrollTop: 0, scrollHeight: 400, clientHeight: 200, isConnected: true };
  const target = (panel, button = false) => ({
    closest: selector => selector === "[data-match-scroll]" ? panel : button ? {} : null
  });
  const fire = (type, element, y, count = 1) => {
    const event = { target: element, cancelable: true, touches: Array.from({ length: count }, (_, identifier) => (
      { identifier, clientX: 10, clientY: y }
    )), preventDefault() { this.prevented = true; } };
    handlers.get(type).handler(event);
    return Boolean(event.prevented);
  };
  const start = (element, y) => fire("touchstart", element, y);
  const move = (element, y, count) => fire("touchmove", element, y, count);
  const arena = target(null), content = target(zone), button = target(zone, true);
  assert.equal(handlers.get("touchmove").options.passive, false);
  start(arena, 100); assert.equal(move(arena, 150), false);
  enable(true);
  assert.equal(classes.has("match-input"), true);
  start(arena, 100);
  assert.equal(move(arena, 150), true);
  assert.equal(move(arena, 150, 2), true);
  assert.equal(fire("gesturestart", arena, 150), true);
  start(content, 100);
  assert.equal(move(content, 130), true);
  assert.equal(move(content, 80), false);
  zone.scrollTop = 200;
  start(content, 100); assert.equal(move(content, 50), true);
  zone.scrollTop = 0;
  assert.equal(start(button, 110), false);
  assert.equal(move(button, 108), false);
  assert.equal(move(button, 40), true);
  assert.equal(zone.scrollTop, 70);
  assert.equal(fire("touchend", button, 40, 0), false);
  enable(false);
  assert.equal(classes.has("match-input"), false);
  assert.equal(fire("gesturestart", arena, 150), false);
});

test("tower beast rendering selects the supplied direction and combat frame instead of the old model", () => {
  const { calls, render } = fixture();
  for (const [dir, sourceY] of [[-1, 0], [1, 224]]) {
    const boss = { x: 50, y: 100, r: 49, towerSprite: "zhuque", facing: dir, castFacing: dir };
    for (const state of [{}, { windupUntil: 11 }, { strikeAt: 10 }, { strikeAt: 9.75 }, { flash: true }]) {
      render.enemyActor({ ...boss, ...state }, 10, "dragon", true);
    }
    const images = calls.filter(call => call[0] === "image").splice(-5);
    assert.deepEqual(images.map(call => call.slice(1, 6)),
      Array.from({ length: 5 }, (_, i) => ["/games/nezha/tower-boss-zhuque.webp", i * 224, sourceY, 224, 224]));
  }
  const pending = fixture(false);
  pending.render.enemyActor({ x: 50, y: 100, r: 49, towerSprite: "baihu" }, 10, "dragon", true);
  assert.equal(pending.calls.some(call => call[0] === "image"), false);
});

test("runtime PNGs retain the supplied transparent frame sheets", () => {
  for (const [file, width, height] of [
    ["wheel", 2112, 560], ["flaming-wheel", 5632, 560], ["samadhi", 2112, 560],
    ["water", 2112, 560], ["slipper", 5632, 560], ["items", 1774, 887]
  ]) {
    const png = readFileSync(new URL("skill-fx-" + file + ".png", assets));
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [width, height]);
    assert.equal(png[25], 6);
  }
  for (const file of ["qiankun", "fan", "gourd"]) {
    const png = readFileSync(new URL("skill-icon-" + file + ".png", assets));
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1254, 1254]);
  }
});

test("animations use the exported frame order, timing and anchors", () => {
  const { calls, sprites, ctx } = fixture();
  sprites.paint(ctx, "flamingWheel", 30, 50, 44, .055 * 7);
  sprites.paint(ctx, "flamingWheel", 30, 50, 44, .055 * 8);
  sprites.paint(ctx, "samadhi", 0, 0, 27, .13);
  const draw = calls.filter(call => call[0] === "image");
  assert.deepEqual(draw.map(call => call[2]), [7 * 704, 0, 2 * 704]);
  assert.deepEqual(draw.map(call => call.slice(4, 6)), [[704, 560], [704, 560], [704, 560]]);
  assert.deepEqual(draw[2].slice(6, 8), [-42, -56]);
  assert.equal(ctx.imageSmoothingEnabled, false);
});

test("shared combat art selects upgraded sprites and rotates left-facing shots to travel direction", () => {
  const { render, calls } = fixture();
  render.wheel({ x: 1, y: 2, orbitAngle: 0 }, 1);
  render.wheel({ x: 1, y: 2, orbitAngle: 0 }, Math.SQRT2);
  render.ring({ x: 5, y: 4, angle: .25, fire: true }, .1);
  render.jigong({ x: 1, y: 2, index: 1, r: 11, angle: -1, age: 0 });
  render.jigong({ x: 1, y: 2, index: 0, r: 16, angle: -1, age: .11 });
  render.brick({ x: 2, y: 3, fromX: 0, fromY: 0, left: .2, ingot: false });
  render.brick({ x: 2, y: 3, fromX: 0, fromY: 0, left: .2, ingot: true });
  const pictures = calls.filter(call => call[0] === "image");
  assert.deepEqual(pictures.map(call => call[1].split("/").at(-1)), [
    "skill-fx-wheel.png", "skill-fx-flaming-wheel.png", "skill-fx-samadhi.png",
    "skill-fx-water.png", "skill-fx-slipper.png", "skill-fx-items.png", "skill-fx-items.png"
  ]);
  assert.deepEqual(calls.filter(call => call[0] === "rotate").map(call => call[1]), [Math.PI + .25, Math.PI - 1]);
  assert.deepEqual(pictures.slice(-2).map(call => call[2]), [925, 1368]);
});

test("flame frames follow each wheel around the orbit instead of sharing one animation clock", () => {
  const { render, calls } = fixture();
  for (const orbitAngle of [0, Math.PI / 4, Math.PI / 2, Math.PI, 3 * Math.PI / 2, -Math.PI / 4, 2 * Math.PI - .05]) {
    render.wheel({ x: 40, y: 50, orbitAngle }, Math.SQRT2);
  }
  const pictures = calls.filter(call => call[0] === "image");
  assert.deepEqual(pictures.map(call => call[2]), [0, 1, 2, 4, 6, 7, 0].map(index => index * 704));
  assert.ok(calls.every(call => call[0] !== "rotate"));
  assert.equal(render.flame, undefined);
});

test("unloaded sprites never draw legacy weapon shapes and the HUD uses new icons", () => {
  const { sprites, render, ctx, calls, requests } = fixture(false);
  render.wheel({ x: 4, y: 6 }, 1, .1);
  render.ring({ x: 0, y: 0, angle: 0, fire: true }, .1);
  render.jigong({ x: 1, y: 2, index: 0, r: 16, angle: -1, age: .1 });
  render.jigong({ x: 1, y: 2, index: 1, r: 11, angle: -1, age: .1, evolved: true });
  render.brick({ x: 2, y: 3, fromX: 0, fromY: 0, left: .2, ingot: false });
  render.ingot(14, 18);
  assert.equal(sprites.paint(ctx, "wheel", 4, 6, 44, .1), false);
  assert.deepEqual(calls, []);
  const canvas = { width: 40, height: 40, getContext: () => ctx };
  assert.equal(sprites.iconFor({ character: "nezha", evolved: [false] }, 0), "qiankun");
  assert.equal(sprites.iconFor({ character: "jigong" }, 1), "gourd");
  assert.equal(sprites.iconFor({ character: "jigong" }, 2), "fan");
  assert.equal(sprites.paintIcon(canvas, "ingot"), false);
  assert.equal(requests.filter(image => image.src.endsWith("skill-fx-items.png")).length, 1);
  for (const image of requests) { image.complete = true; image.naturalWidth = 5632; }
  assert.ok(["qiankun", "fan", "gourd"].every(key => sprites.paintIcon(canvas, key)));
  assert.equal(sprites.paintIcon(canvas, "ingot"), true);
  assert.deepEqual(calls.at(-1).slice(-4), [0, 7, 40, 26]);
});

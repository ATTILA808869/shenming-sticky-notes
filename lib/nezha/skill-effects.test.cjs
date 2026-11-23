const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const assets = join(__dirname, "assets");
const source = name => readFileSync(join(assets, name), "utf8");

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
  vm.runInContext(source("skill-effects.js") + "\n" + source("enemy-art.js"), context);
  const sprites = vm.runInContext("NezhaSkillArt", context);
  const ctx = {
    save() {}, restore() {}, beginPath() {}, closePath() {}, lineTo() {}, arc() {}, fill() {}, stroke() {}, fillRect() {}, strokeRect() {}, clearRect() {},
    translate(...args) { calls.push(["translate", ...args]); },
    rotate(angle) { calls.push(["rotate", angle]); },
    drawImage(image, ...args) { calls.push(["image", image.src, ...args]); }
  };
  const render = vm.runInContext("NezhaCombatArt", context).create(ctx);
  return { calls, requests, sprites, ctx, render };
}

test("runtime PNGs retain the supplied transparent frame sheets", () => {
  for (const [file, width, height] of [
    ["wheel", 2112, 560], ["flaming-wheel", 5632, 560], ["samadhi", 2112, 560],
    ["water", 2112, 560], ["slipper", 5632, 560], ["items", 1774, 887]
  ]) {
    const png = readFileSync(join(assets, "skill-fx-" + file + ".png"));
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [width, height]);
    assert.equal(png[25], 6);
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
  const prior = calls.length;
  render.flame({ x: 40, y: 50, life: .2 }, Math.SQRT2);
  assert.equal(calls.length, prior);
});

test("unloaded sprites preserve the existing effect and HUD items share one image request", () => {
  const { sprites, render, ctx, calls, requests } = fixture(false);
  render.wheel({ x: 4, y: 6 }, 1, .1);
  assert.equal(sprites.paint(ctx, "wheel", 4, 6, 44, .1), false);
  assert.equal(calls.some(call => call[0] === "image"), false);
  const canvas = { width: 40, height: 40, getContext: () => ctx };
  assert.equal(sprites.paintIcon(canvas, "gourd"), false);
  assert.equal(sprites.paintIcon(canvas, "ingot"), false);
  assert.deepEqual(requests.map(image => image.src), [
    "/games/nezha/skill-fx-wheel.png", "/games/nezha/skill-fx-items.png"
  ]);
  requests[1].complete = true;
  requests[1].naturalWidth = 1774;
  assert.equal(sprites.paintIcon(canvas, "ingot"), true);
  assert.deepEqual(calls.at(-1).slice(-4), [0, 7, 40, 26]);
});

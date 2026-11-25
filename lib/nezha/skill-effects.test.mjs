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

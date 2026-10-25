import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena } from '../server/arena.js';
import { CFG } from '../shared/config.js';
import { massToRadius as R, moveSpeed } from '../shared/physics.js';

const mk = (o = {}) => new Arena('t', { ...CFG, FOOD_COUNT: 0, VIRUS_COUNT: 0, ...o });
const put = (a, name, x, y, m) => { const p = a.addPlayer(name); p.cells = [a.makeCell(x, y, m)]; return p; };

test('1 Masse/Radius', () => { assert.equal(R(100), 100); assert.equal(R(400), 200); });
test('2 Geschwindigkeit sinkt mit Masse', () => {
  assert.ok(moveSpeed(R(20)) > moveSpeed(R(100)) && moveSpeed(R(100)) > moveSpeed(R(1000)));
});
test('2b Bewegung folgt Eingabe und Arenagrenze', () => {
  const a = mk(), p = put(a, 'A', 3000, 3000, 20); a.setInput(p, 1, 0);
  for (let i = 0; i < 30; i++) a.tick();
  assert.ok(p.cells[0].x > 3300);
  p.cells[0].x = 5990; for (let i = 0; i < 30; i++) a.tick();
  assert.ok(p.cells[0].x <= CFG.MAP - R(p.cells[0].m));
});
test('3 Teilung: Masse erhalten, Boost, Mindestmasse', () => {
  const a = mk(), p = put(a, 'A', 3000, 3000, 100); a.setInput(p, 1, 0);
  const before = a.total(p); a.split(p);
  assert.equal(p.cells.length, 2); assert.ok(Math.abs(a.total(p) - before) < 1e-9);
  assert.equal(p.cells[0].m, 50); assert.ok(p.cells[1].bv > 0);
  const q = put(a, 'B', 500, 500, 30); a.split(q); assert.equal(q.cells.length, 1);
});
test('4 Fressregeln', () => {
  const a = mk(), big = put(a, 'big', 1000, 1000, 100), sm = put(a, 'sm', 1010, 1000, 50);
  a.resolveEating(); assert.equal(sm.alive, false); assert.ok(big.cells[0].m === 150);
  const b = mk(), x = put(b, 'x', 1000, 1000, 100), y = put(b, 'y', 1010, 1000, 90);
  b.resolveEating(); assert.ok(x.alive && y.alive, 'Verhältnis < 1.25: kein Fressen');
  const c = mk(), u = put(c, 'u', 1000, 1000, 100), w = put(c, 'w', 1000 + 120, 1000, 10);
  c.resolveEating(); assert.ok(w.alive, 'ohne Überlappung kein Fressen');
});
test('4b Futter erhöht Masse', () => {
  const a = mk({ FOOD_COUNT: 0 }), p = put(a, 'A', 1000, 1000, 20);
  const f = { id: 9999, x: 1005, y: 1000 }; a.food.set(f.id, f); a.fgrid.set(Math.floor(1005 / 100) * 10000 + 10, new Set([f]));
  a.resolveEating(); assert.equal(p.cells[0].m, 21);
});
test('5 Masseabgabe', () => {
  const a = mk(), p = put(a, 'A', 3000, 3000, 100); a.eject(p);
  assert.equal(p.cells[0].m, 84); assert.equal(a.pellets.size, 1);
  const q = put(a, 'B', 100, 100, 30); a.eject(q); assert.equal(q.cells[0].m, 30);
});
test('6 Zusammenführung erst nach Wartezeit', () => {
  const a = mk(), p = put(a, 'A', 3000, 3000, 100); p.cells.push(a.makeCell(3010, 3000, 100));
  p.cells.forEach((c) => (c.mergeAt = 30)); a.movePlayer(p, 0.03); assert.equal(p.cells.length, 2);
  a.time = 31; a.movePlayer(p, 0.03); assert.equal(p.cells.length, 1); assert.ok(Math.abs(p.cells[0].m - 200) < 0.1);
});
test('7 Viren: große Zelle explodiert, kleine nicht, Fütterung erzeugt Virus', () => {
  const a = mk(), p = put(a, 'A', 1000, 1000, 300); a.spawnVirus(1000, 1000);
  const before = 300 + CFG.VIRUS_MASS; a.resolveEating();
  assert.ok(p.cells.length > 1); assert.ok(Math.abs(a.total(p) - before) < 1e-6);
  const b = mk(), q = put(b, 'B', 1000, 1000, 60); b.spawnVirus(1000, 1000); b.resolveEating();
  assert.equal(q.cells.length, 1); assert.equal(b.viruses.size, 1);
  const c = mk({ VIRUS_COUNT: 1 }); c.viruses.clear(); c.spawnVirus(2000, 2000);
  for (let i = 0; i < CFG.VIRUS_FEEDS; i++) { c.pellets.set(1000 + i, { id: 1000 + i, x: 2000, y: 2000, m: 13, owner: 0, born: 0, bx: 1, by: 0, bv: 0 }); c.moveObjects(0.03); }
  assert.equal(c.viruses.size, 2);
});
test('10 hohe Spielerzahl: Tick-Dauer', () => {
  const a = new Arena('load', { ...CFG, MAX_PLAYERS: 100 });
  for (let i = 0; i < 80; i++) { const p = a.addPlayer('P' + i); a.setInput(p, Math.random() - .5, Math.random() - .5); if (i % 3 === 0) { p.cells[0].m = 300; a.split(p); } }
  const t = performance.now(); for (let i = 0; i < 60; i++) { a.tick(); for (const p of a.players.values()) a.snapshotFor(p); }
  const avg = (performance.now() - t) / 60; console.log('  Ø ms/Tick inkl. Snapshots (80 Spieler):', avg.toFixed(2));
  assert.ok(avg < 1000 / CFG.TICK_RATE);
});

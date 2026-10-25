import { randomUUID } from 'node:crypto';
import { CFG } from '../shared/config.js';
import { massToRadius as R, moveSpeed, canEat, overlapEats, cameraScale, mergeDelay } from '../shared/physics.js';

const B = 100; // Food-Grid-Bucket
const gk = (gx, gy) => gx * 10000 + gy;
const cl = (v, a, b) => Math.max(a, Math.min(b, v));

export class Arena {
  constructor(id, cfg = CFG) {
    Object.assign(this, { id, cfg, time: 0, tickNo: 0, nid: 1, pid: 1, emptySince: null, lb: [],
      players: new Map(), food: new Map(), fgrid: new Map(), viruses: new Map(), pellets: new Map() });
    for (let i = 0; i < cfg.VIRUS_COUNT; i++) this.spawnVirus();
    this.fillFood();
  }
  rnd() { return Math.random() * this.cfg.MAP; }
  makeCell(x, y, m) { return { id: this.nid++, x, y, m, bx: 0, by: 0, bv: 0, mergeAt: 0 }; }
  fillFood() {
    while (this.food.size < this.cfg.FOOD_COUNT) {
      const f = { id: this.nid++, x: this.rnd(), y: this.rnd() };
      this.food.set(f.id, f);
      const k = gk(Math.floor(f.x / B), Math.floor(f.y / B));
      (this.fgrid.get(k) ?? this.fgrid.set(k, new Set()).get(k)).add(f);
    }
  }
  delFood(f) { this.food.delete(f.id); this.fgrid.get(gk(Math.floor(f.x / B), Math.floor(f.y / B)))?.delete(f); }
  spawnVirus(x = this.rnd(), y = this.rnd(), dir) {
    const v = { id: this.nid++, x, y, m: this.cfg.VIRUS_MASS, fed: 0, bx: dir?.x ?? 0, by: dir?.y ?? 0, bv: dir ? 700 : 0 };
    this.viruses.set(v.id, v); return v;
  }
  addPlayer(name) {
    const p = { id: this.pid++, name: String(name || 'Zelle').slice(0, 16), token: randomUUID(), cells: [], dx: 0, dy: 0, mag: 0,
      ax: 1, ay: 0, alive: false, ws: null, disc: null, score: 0, cx: this.cfg.MAP / 2, cy: this.cfg.MAP / 2,
      sumR: 40, known: new Set(), justDied: false, killer: null };
    this.players.set(p.id, p); this.spawn(p); return p;
  }
  spawn(p) {
    p.cells = [this.makeCell(this.rnd(), this.rnd(), this.cfg.START_MASS)];
    p.alive = true; p.score = this.cfg.START_MASS; p.known.clear();
  }
  removePlayer(p) { this.players.delete(p.id); }
  setInput(p, x, y) { // validiert: endliche Zahlen, Betrag auf 1 begrenzt
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const l = Math.hypot(x, y);
    if (l < 0.05) { p.mag = 0; return; }
    p.dx = x / l; p.dy = y / l; p.ax = p.dx; p.ay = p.dy; p.mag = Math.min(l, 1);
  }
  total(p) { return p.cells.reduce((s, c) => s + c.m, 0); }

  split(p) {
    if (!p.alive) return;
    for (const c of [...p.cells]) {
      if (p.cells.length >= this.cfg.MAX_CELLS) break;
      if (c.m < this.cfg.MIN_SPLIT_MASS) continue;
      const d = mergeDelay(c.m, this.cfg);
      c.m /= 2;
      const n = this.makeCell(c.x + p.ax * R(c.m), c.y + p.ay * R(c.m), c.m);
      n.bx = p.ax; n.by = p.ay; n.bv = this.cfg.SPLIT_SPEED;
      n.mergeAt = c.mergeAt = this.time + d;
      p.cells.push(n);
    }
  }
  eject(p) {
    if (!p.alive) return;
    for (const c of p.cells) {
      if (c.m < this.cfg.EJECT_MIN) continue;
      c.m -= this.cfg.EJECT_LOSS;
      const r = R(c.m);
      const e = { id: this.nid++, x: c.x + p.ax * r, y: c.y + p.ay * r, m: this.cfg.EJECT_MASS, owner: p.id, born: this.time,
        bx: p.ax, by: p.ay, bv: this.cfg.EJECT_SPEED };
      this.pellets.set(e.id, e);
    }
  }
  explode(p, c) {
    const k = Math.min(this.cfg.MAX_CELLS - p.cells.length, this.cfg.VIRUS_SPLITS);
    if (k <= 0) return;
    const share = c.m / (k + 1); c.m = share;
    const a0 = Math.random() * Math.PI * 2;
    for (let i = 0; i < k; i++) {
      const a = a0 + (i * 2 * Math.PI) / k, n = this.makeCell(c.x, c.y, share);
      n.bx = Math.cos(a); n.by = Math.sin(a); n.bv = this.cfg.SPLIT_SPEED * 0.8;
      n.mergeAt = c.mergeAt = this.time + mergeDelay(share * (k + 1), this.cfg);
      p.cells.push(n);
    }
  }

  step(o, dt, decay, r = 0) {
    if (o.bv > 1) { o.x += o.bx * o.bv * dt; o.y += o.by * o.bv * dt; o.bv *= Math.exp(-decay * dt); } else o.bv = 0;
    o.x = cl(o.x, r, this.cfg.MAP - r); o.y = cl(o.y, r, this.cfg.MAP - r);
  }
  movePlayer(p, dt) {
    const c = this.cfg;
    for (const k of p.cells) {
      const r = R(k.m), sp = moveSpeed(r, c) * p.mag;
      k.x += p.dx * sp * dt; k.y += p.dy * sp * dt;
      this.step(k, dt, c.BOOST_DECAY, r);
      if (k.m > c.DECAY_MIN) k.m -= k.m * c.DECAY_RATE * dt;
    }
    for (let i = 0; i < p.cells.length; i++) for (let j = i + 1; j < p.cells.length; j++) {
      const a = p.cells[i], b = p.cells[j]; if (a.dead || b.dead) continue;
      const ra = R(a.m), rb = R(b.m), dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
      if (d >= ra + rb) continue;
      if (this.time >= a.mergeAt && this.time >= b.mergeAt) {
        if (d < Math.max(ra, rb)) { const [big, sm] = a.m >= b.m ? [a, b] : [b, a]; big.m += sm.m; sm.dead = true; }
      } else {
        const push = (ra + rb - d) * Math.min(1, dt * 10) * 0.5;
        a.x -= (dx / d) * push; a.y -= (dy / d) * push; b.x += (dx / d) * push; b.y += (dy / d) * push;
      }
    }
    p.cells = p.cells.filter((k) => !k.dead);
  }

  resolveEating() {
    const c = this.cfg, grid = new Map(), CB = 400, all = [];
    for (const p of this.players.values()) if (p.alive) for (const k of p.cells) {
      all.push([p, k]);
      const key = gk(Math.floor(k.x / CB), Math.floor(k.y / CB));
      (grid.get(key) ?? grid.set(key, []).get(key)).push([p, k]);
    }
    for (const [p, k] of all) {
      if (k.dead) continue;
      const r = R(k.m);
      for (let gx = Math.floor((k.x - r) / B); gx <= Math.floor((k.x + r) / B); gx++)
        for (let gy = Math.floor((k.y - r) / B); gy <= Math.floor((k.y + r) / B); gy++) {
          const s = this.fgrid.get(gk(gx, gy)); if (!s) continue;
          for (const f of [...s]) if (Math.hypot(f.x - k.x, f.y - k.y) < r) { k.m += c.FOOD_MASS; this.delFood(f); }
        }
      for (const e of this.pellets.values())
        if (!(e.owner === p.id && this.time - e.born < 0.3) && Math.hypot(e.x - k.x, e.y - k.y) < r) { k.m += e.m; this.pellets.delete(e.id); }
      for (const v of this.viruses.values())
        if (k.m >= c.VIRUS_EAT_MIN && overlapEats(Math.hypot(v.x - k.x, v.y - k.y), r, R(v.m), c)) {
          this.viruses.delete(v.id); k.m += v.m; this.explode(p, k);
        }
      for (let gx = Math.floor((k.x - r) / CB); gx <= Math.floor((k.x + r) / CB); gx++)
        for (let gy = Math.floor((k.y - r) / CB); gy <= Math.floor((k.y + r) / CB); gy++)
          for (const [q, o] of grid.get(gk(gx, gy)) ?? []) {
            if (q === p || o.dead || k.dead) continue;
            if (canEat(k.m, o.m, c) && overlapEats(Math.hypot(o.x - k.x, o.y - k.y), R(k.m), R(o.m), c)) {
              k.m += o.m; o.dead = true; q.killer = p.name;
            }
          }
    }
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      p.cells = p.cells.filter((k) => !k.dead);
      if (!p.cells.length) { p.alive = false; p.justDied = true; } else p.score = Math.max(p.score, this.total(p));
    }
  }
  moveObjects(dt) {
    for (const e of this.pellets.values()) {
      this.step(e, dt, this.cfg.EJECT_DECAY, 10);
      for (const v of this.viruses.values()) if (Math.hypot(v.x - e.x, v.y - e.y) < R(v.m)) {
        this.pellets.delete(e.id);
        if (++v.fed >= this.cfg.VIRUS_FEEDS) {
          v.fed = 0;
          if (this.viruses.size < this.cfg.VIRUS_COUNT * 2) this.spawnVirus(v.x, v.y, { x: e.bx || 1, y: e.by });
        }
        break;
      }
    }
    for (const v of this.viruses.values()) this.step(v, dt, 3, R(v.m));
  }

  tick() {
    const dt = 1 / this.cfg.TICK_RATE; this.time += dt; this.tickNo++;
    this.fillFood();
    while (this.viruses.size < this.cfg.VIRUS_COUNT) this.spawnVirus();
    for (const p of this.players.values()) if (p.alive) this.movePlayer(p, dt);
    this.moveObjects(dt);
    this.resolveEating();
    if (this.tickNo % this.cfg.TICK_RATE === 0) {
      this.lb = [...this.players.values()].filter((p) => p.alive).map((p) => [p.name, Math.round(this.total(p))])
        .sort((a, b) => b[1] - a[1]).slice(0, 10);
    }
    for (const p of [...this.players.values()])
      if (p.disc !== null && this.time - p.disc > this.cfg.RECONNECT_GRACE) this.removePlayer(p);
    this.emptySince = this.players.size ? null : (this.emptySince ?? this.time);
  }

  snapshotFor(p) {
    const c = this.cfg; let cx = p.cx, cy = p.cy;
    if (p.cells.length) {
      cx = cy = p.sumR = 0;
      for (const k of p.cells) { cx += k.x; cy += k.y; p.sumR += R(k.m); }
      cx /= p.cells.length; cy /= p.cells.length; p.cx = cx; p.cy = cy;
    }
    const half = c.VIEW_HALF / cameraScale(p.sumR);
    const inV = (x, y, r = 0) => Math.abs(x - cx) < half + r && Math.abs(y - cy) < half + r;
    const out = { t: 's', k: this.tickNo, me: p.cells.map((k) => k.id), sc: Math.round(this.total(p)), c: [], v: [], e: [] };
    for (const q of this.players.values()) if (q.alive) for (const k of q.cells) if (inV(k.x, k.y, R(k.m))) {
      out.c.push([k.id, q.id, Math.round(k.x), Math.round(k.y), Math.round(k.m * 10) / 10]);
      if (!p.known.has(q.id)) { p.known.add(q.id); (out.n ??= {})[q.id] = q.name; }
    }
    for (const v of this.viruses.values()) if (inV(v.x, v.y, R(v.m))) out.v.push([v.id, Math.round(v.x), Math.round(v.y), v.m]);
    for (const e of this.pellets.values()) if (inV(e.x, e.y)) out.e.push([e.id, Math.round(e.x), Math.round(e.y), e.owner]);
    if (this.tickNo % 3 === 0) {
      out.f = [];
      for (let gx = Math.floor((cx - half) / B); gx <= Math.floor((cx + half) / B); gx++)
        for (let gy = Math.floor((cy - half) / B); gy <= Math.floor((cy + half) / B); gy++)
          for (const f of this.fgrid.get(gk(gx, gy)) ?? []) if (inV(f.x, f.y)) out.f.push([Math.round(f.x), Math.round(f.y)]);
    }
    if (this.tickNo % 15 === 0) out.lb = this.lb;
    return out;
  }
}

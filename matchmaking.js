import { Arena } from './arena.js';
export class Matchmaking {
  constructor(cfg) { this.cfg = cfg; this.arenas = new Map(); this.n = 1; }
  assign() {
    for (const a of this.arenas.values()) if (a.players.size < this.cfg.MAX_PLAYERS) return a;
    const a = new Arena('arena-' + this.n++, this.cfg); this.arenas.set(a.id, a); return a;
  }
  findByToken(t) {
    for (const a of this.arenas.values()) for (const p of a.players.values()) if (p.token === t) return { arena: a, p };
    return null;
  }
  tick() {
    for (const a of this.arenas.values()) {
      a.tick();
      if (a.emptySince !== null && a.time - a.emptySince > 60 && this.arenas.size > 1) this.arenas.delete(a.id);
    }
  }
}

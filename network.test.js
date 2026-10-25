import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { createServer } from '../server/index.js';
import { CFG } from '../shared/config.js';

const cfg = { ...CFG, FOOD_COUNT: 50, VIRUS_COUNT: 0 };
function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`), msgs = [];
  ws.on('message', (d) => msgs.push(JSON.parse(d)));
  const open = new Promise((r) => ws.on('open', r));
  const waitFor = async (fn, ms = 3000) => { const t = Date.now(); for (;;) { const m = msgs.find(fn); if (m) return m; if (Date.now() - t > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 20)); } };
  return { ws, msgs, open, waitFor, send: (o) => ws.send(JSON.stringify(o)) };
}

test('8 Synchronisierung: zwei Clients sehen sich; 9 Wiederverbindung', async () => {
  const s = await createServer({ port: 0, cfg });
  try {
    const a = client(s.port), b = client(s.port); await Promise.all([a.open, b.open]);
    a.send({ t: 'join', name: 'Alice' }); b.send({ t: 'join', name: 'Bob' });
    const wa = await a.waitFor((m) => m.t === 'w'), wb = await b.waitFor((m) => m.t === 'w');
    assert.equal(wa.arena, wb.arena); assert.notEqual(wa.id, wb.id);
    const arena = s.mm.arenas.get(wa.arena);
    for (const p of arena.players.values()) p.cells[0].x = p.id === wa.id ? 3000 : 3100, p.cells[0].y = 3000;
    const seen = await a.waitFor((m) => m.t === 's' && m.c.some((c) => c[1] === wb.id));
    assert.equal(seen.n[wb.id], 'Bob');
    a.send({ t: 'i', x: 1, y: 0 });
    await a.waitFor((m) => m.t === 's' && m.c.some((c) => c[1] === wa.id && c[2] > 3050));
    // Aktion mit Müll wird ignoriert
    a.send({ t: 'i', x: 'abc', y: null }); a.ws.send('kein json');
    // Wiederverbindung
    a.ws.close(); await new Promise((r) => setTimeout(r, 100));
    const a2 = client(s.port); await a2.open; a2.send({ t: 'join', name: 'Alice', token: wa.token });
    const w2 = await a2.waitFor((m) => m.t === 'w'); assert.equal(w2.id, wa.id);
    await a2.waitFor((m) => m.t === 's' && m.me.length > 0);
    a2.ws.close(); b.ws.close();
  } finally { await s.close(); }
});
test('Matchmaking: volle Arena -> neue Arena', async () => {
  const s = await createServer({ port: 0, cfg: { ...cfg, MAX_PLAYERS: 1 } });
  try {
    const a = client(s.port), b = client(s.port); await Promise.all([a.open, b.open]);
    a.send({ t: 'join', name: 'A' }); const wa = await a.waitFor((m) => m.t === 'w');
    b.send({ t: 'join', name: 'B' }); const wb = await b.waitFor((m) => m.t === 'w');
    assert.notEqual(wa.arena, wb.arena); a.ws.close(); b.ws.close();
  } finally { await s.close(); }
});

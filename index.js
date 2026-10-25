import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { CFG } from '../shared/config.js';
import { Matchmaking } from './matchmaking.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const clean = (s) => String(s ?? '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16) || 'Zelle';

export function createServer({ port = Number(process.env.PORT) || 3000, cfg = CFG } = {}) {
  const mm = new Matchmaking(cfg);
  const server = http.createServer((req, res) => {
    let u = decodeURIComponent((req.url || '/').split('?')[0]);
    if (u === '/') u = '/public/index.html';
    else if (!u.startsWith('/shared/')) u = '/public' + u;
    const f = path.normalize(path.join(root, u));
    if (!f.startsWith(path.join(root, 'public')) && !f.startsWith(path.join(root, 'shared'))) { res.writeHead(403).end(); return; }
    fs.readFile(f, (e, d) => e ? res.writeHead(404).end('Not found') : res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }).end(d));
  });
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 512 });

  wss.on('connection', (ws) => {
    ws.p = null; ws.arena = null; ws.msgs = 0;
    const rl = setInterval(() => (ws.msgs = 0), 1000);
    ws.on('message', (raw) => {
      if (++ws.msgs > 150) return ws.close(1008, 'rate limit');
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (!m || typeof m !== 'object') return;
      if (m.t === 'join') return join(ws, m);
      if (!ws.p || !ws.p.alive) return;
      if (m.t === 'i') ws.arena.setInput(ws.p, +m.x, +m.y);
      else if (m.t === 'split') { const n = Date.now(); if (n - (ws.ls ?? 0) > 150) { ws.ls = n; ws.arena.split(ws.p); } }
      else if (m.t === 'eject') { const n = Date.now(); if (n - (ws.le ?? 0) > 40) { ws.le = n; ws.arena.eject(ws.p); } }
    });
    ws.on('close', () => { clearInterval(rl); if (ws.p && ws.p.ws === ws) { ws.p.ws = null; ws.p.disc = ws.arena.time; ws.p.mag = 0; } });
    ws.on('error', () => {});
  });

  function join(ws, m) {
    const found = typeof m.token === 'string' ? mm.findByToken(m.token) : null;
    if (ws.p && (!found || found.p !== ws.p)) { ws.arena.removePlayer(ws.p); ws.p = null; }
    if (found) {
      ws.p = found.p; ws.arena = found.arena;
      if (ws.p.ws && ws.p.ws !== ws) try { ws.p.ws.close(); } catch {}
      ws.p.disc = null; if (!ws.p.alive) ws.arena.spawn(ws.p);
      if (m.name) ws.p.name = clean(m.name);
    } else {
      ws.arena = mm.assign(); ws.p = ws.arena.addPlayer(clean(m.name));
    }
    ws.p.ws = ws; ws.p.known.clear();
    ws.send(JSON.stringify({ t: 'w', id: ws.p.id, token: ws.p.token, map: cfg.MAP, arena: ws.arena.id }));
  }

  let next = performance.now(), timer, running = true;
  function loop() {
    if (!running) return;
    let n = 0;
    while (next <= performance.now() && n++ < 5) {
      mm.tick();
      for (const a of mm.arenas.values()) {
        const send = a.tickNo % cfg.SEND_EVERY === 0;
        for (const p of a.players.values()) {
          if (!p.ws || p.ws.readyState !== 1) continue;
          if (p.justDied) { p.justDied = false; p.ws.send(JSON.stringify({ t: 'd', score: Math.round(p.score), by: p.killer })); }
          if (send && p.ws.bufferedAmount < 1e6) p.ws.send(JSON.stringify(a.snapshotFor(p)));
        }
      }
      next += 1000 / cfg.TICK_RATE;
    }
    if (next < performance.now()) next = performance.now();
    timer = setTimeout(loop, Math.max(0, next - performance.now()));
  }
  loop();
  return new Promise((resolve) => server.listen(port, () => resolve({
    server, wss, mm, port: server.address().port,
    close: () => { running = false; clearTimeout(timer); wss.clients.forEach((c) => c.terminate()); return new Promise((r) => server.close(r)); },
  })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().then((s) => console.log(`Server läuft auf Port ${s.port}`));
}

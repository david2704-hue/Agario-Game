import { massToRadius as R, cameraScale } from '/shared/physics.js';
const $ = (id) => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
let W, H, dpr, ws, token = sessionStorage.token, playing = false, MAP = 6000;
const cells = new Map(), viruses = new Map(), pellets = new Map(), names = new Map();
let food = [], myIds = new Set(), lb = [], score = 0, me = 0;
const cam = { x: 3000, y: 3000, s: 1 };
const aim = { x: 0, y: 0 }; let lastSent = '';

function resize() { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; }
addEventListener('resize', resize); resize();

// ---------- Netzwerk (mit automatischer Wiederverbindung) ----------
function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  ws.onopen = () => { $('st').textContent = ''; if (playing) join(); };
  ws.onclose = () => { $('st').textContent = 'Verbindung getrennt – verbinde neu…'; setTimeout(connect, 1000); };
  ws.onmessage = (e) => handle(JSON.parse(e.data));
}
const send = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
const join = () => send({ t: 'join', name: $('name').value, token });
function handle(m) {
  if (m.t === 'w') { me = m.id; token = sessionStorage.token = m.token; MAP = m.map; }
  else if (m.t === 'd') { playing = false; $('res').textContent = `Punktzahl: ${m.score}` + (m.by ? ` · gefressen von ${m.by}` : ''); $('over').classList.remove('hide'); }
  else if (m.t === 's') {
    myIds = new Set(m.me); score = m.sc; if (m.n) for (const k in m.n) names.set(+k, m.n[k]);
    const seen = new Set();
    for (const [id, o, x, y, ms] of m.c) { seen.add(id); const c = cells.get(id); if (c) { c.tx = x; c.ty = y; c.tm = ms; } else cells.set(id, { x, y, m: ms, tx: x, ty: y, tm: ms, o }); }
    for (const id of cells.keys()) if (!seen.has(id)) cells.delete(id);
    viruses.clear(); for (const [id, x, y, ms] of m.v) viruses.set(id, { x, y, m: ms });
    pellets.clear(); for (const [id, x, y, o] of m.e) pellets.set(id, { x, y, o });
    if (m.f) food = m.f; if (m.lb) lb = m.lb;
  }
}
// ---------- Eingabe: Maus, Touch-Joystick, Tasten ----------
const joy = { id: null, bx: 0, by: 0, x: 0, y: 0 };
addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; const dx = e.clientX - W / 2, dy = e.clientY - H / 2, l = Math.hypot(dx, dy) || 1, mg = Math.min(l / 90, 1); aim.x = dx / l * mg; aim.y = dy / l * mg; });
cv.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) if (joy.id === null && t.clientX < W * 0.6) { joy.id = t.identifier; joy.bx = joy.x = t.clientX; joy.by = joy.y = t.clientY; } e.preventDefault(); }, { passive: false });
cv.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === joy.id) { joy.x = t.clientX; joy.y = t.clientY; const dx = joy.x - joy.bx, dy = joy.y - joy.by, l = Math.hypot(dx, dy) || 1, mg = Math.min(l / 60, 1); aim.x = dx / l * mg; aim.y = dy / l * mg; } e.preventDefault(); }, { passive: false });
const endT = (e) => { for (const t of e.changedTouches) if (t.identifier === joy.id) { joy.id = null; aim.x = aim.y = 0; } };
cv.addEventListener('touchend', endT); cv.addEventListener('touchcancel', endT);
const act = (el, t) => el.addEventListener('pointerdown', (e) => { e.preventDefault(); if (playing) send({ t }); });
act($('split'), 'split'); act($('eject'), 'eject');
addEventListener('keydown', (e) => { if (!playing || e.repeat && e.code === 'Space') return; if (e.code === 'Space') send({ t: 'split' }); if (e.code === 'KeyW') send({ t: 'eject' }); });
setInterval(() => { if (!playing) return; const s = aim.x.toFixed(2) + aim.y.toFixed(2); if (s !== lastSent) { lastSent = s; send({ t: 'i', x: aim.x, y: aim.y }); } }, 33);
const start = () => { playing = true; $('start').classList.add('hide'); $('over').classList.add('hide'); join(); };
$('play').onclick = start; $('again').onclick = start;

// ---------- Rendering ----------
const hue = (o) => (o * 137) % 360;
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  const k = 1 - Math.exp(-dt * 18);
  for (const c of cells.values()) { c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k; c.m += (c.tm - c.m) * k; }
  let sx = 0, sy = 0, sr = 0, n = 0;
  for (const id of myIds) { const c = cells.get(id); if (c) { sx += c.x; sy += c.y; sr += R(c.m); n++; } }
  if (n) { const kc = 1 - Math.exp(-dt * 10); cam.x += (sx / n - cam.x) * kc; cam.y += (sy / n - cam.y) * kc; cam.s += (cameraScale(sr) - cam.s) * (1 - Math.exp(-dt * 4)); }
  const S = cam.s * Math.max(W, H) / 1400;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#f2fbff'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(S, S); ctx.translate(-cam.x, -cam.y);
  const x0 = cam.x - W / 2 / S, x1 = cam.x + W / 2 / S, y0 = cam.y - H / 2 / S, y1 = cam.y + H / 2 / S;
  ctx.strokeStyle = '#d6e6ee'; ctx.lineWidth = 1 / S; ctx.beginPath();
  for (let x = Math.max(0, Math.floor(x0 / 50) * 50); x <= Math.min(MAP, x1); x += 50) { ctx.moveTo(x, Math.max(0, y0)); ctx.lineTo(x, Math.min(MAP, y1)); }
  for (let y = Math.max(0, Math.floor(y0 / 50) * 50); y <= Math.min(MAP, y1); y += 50) { ctx.moveTo(Math.max(0, x0), y); ctx.lineTo(Math.min(MAP, x1), y); }
  ctx.stroke(); ctx.strokeStyle = '#789'; ctx.lineWidth = 4 / S; ctx.strokeRect(0, 0, MAP, MAP);
  food.forEach(([x, y], i) => { ctx.fillStyle = `hsl(${(i * 47) % 360},80%,55%)`; ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.fill(); });
  for (const p of pellets.values()) { ctx.fillStyle = `hsl(${hue(p.o)},70%,55%)`; ctx.beginPath(); ctx.arc(p.x, p.y, R(13), 0, 7); ctx.fill(); }
  for (const v of viruses.values()) { const r = R(v.m); ctx.fillStyle = '#3ddc4a'; ctx.strokeStyle = '#2a9d34'; ctx.lineWidth = 4; ctx.beginPath();
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, rr = i % 2 ? r * .93 : r; ctx[i ? 'lineTo' : 'moveTo'](v.x + Math.cos(a) * rr, v.y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke(); }
  for (const c of [...cells.values()].sort((a, b) => a.m - b.m)) {
    const r = R(c.m); ctx.fillStyle = `hsl(${hue(c.o)},70%,55%)`; ctx.strokeStyle = `hsl(${hue(c.o)},70%,40%)`; ctx.lineWidth = Math.max(3, r * .06);
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 7); ctx.fill(); ctx.stroke();
    if (r * S > 14) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0006'; ctx.lineWidth = r * .05; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold ${Math.max(14, r * .38)}px system-ui`; const nm = names.get(c.o) || ''; ctx.strokeText(nm, c.x, c.y); ctx.fillText(nm, c.x, c.y); }
  }
  ctx.restore();
  if (joy.id !== null) { ctx.strokeStyle = '#0006'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(joy.bx, joy.by, 60, 0, 7); ctx.stroke(); ctx.fillStyle = '#0005'; ctx.beginPath(); ctx.arc(joy.bx + aim.x * 60, joy.by + aim.y * 60, 24, 0, 7); ctx.fill(); }
  $('hud').textContent = playing ? `Masse: ${score}` : '';
  $('lb').innerHTML = '<b>Rangliste</b><br>' + lb.map(([n, m], i) => `${i + 1}. ${n.replace(/</g, '&lt;')} – ${m}`).join('<br>');
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame); connect();

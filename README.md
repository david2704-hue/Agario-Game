# Blobs.io – Agar.io-Mobile-Klon (eigene Assets, eigener Code)

## Architektur (Phase 1)
- **Stack**: Node.js 20 + `ws` (WebSockets), Client in Vanilla-JS/Canvas. Bewusst **ohne** TypeScript/Vite-Build, damit Server und Client dieselbe Physik-Datei (`shared/physics.js`) ohne Build-Schritt nutzen. Migration zu TS/Vite ist später möglich.
- **Autoritativer Server**: feste Tickrate (30 Hz, `shared/config.js`), alle Fress-/Teil-/Auswurf-Entscheidungen serverseitig. Client sendet nur Eingaben (`i`, `split`, `eject`), validiert + rate-limitiert.
- **Matchmaking**: `server/matchmaking.js` – erste Arena mit freiem Platz, sonst neue Arena; leere Arenen werden entfernt.
- **Wiederverbindung**: Token in `sessionStorage`, Server hält den Spieler 10 s (`RECONNECT_GRACE`).
- **Netz**: Sichtbereich-Culling pro Spieler, Futter nur jeden 3. Tick, Namen nur einmal pro sichtbarem Spieler.

## Physik – Quellenlage
Es gibt keine offiziellen Parameter. Die Werte in `shared/config.js` sind mit **(K)** (aus Community-Dokumentation offener Agar.io-Server, nicht selbst verifiziert) oder **(A)** (Annahme) markiert.
Formeln: `r = 10·√m` · `v = 2200·r^-0.439` px/s · Fressen: `m_A ≥ 1.25·m_B` und Abstand `< r_A − 0.4·r_B` · Zoom `min(64/Σr, 1)^0.4` · Merge-Zeit `30 s + 0.02·m`.
**Phase 4 (Kalibrierung gegen das echte Spiel) ist NICHT erledigt** – dafür sind Messungen am Original nötig.

## Starten
```
npm install
npm start          # http://localhost:3000
npm test
```
Zum Testen mit Handy im selben WLAN: `http://<PC-IP>:3000` öffnen.

## Deployment
Dauerhaft laufender Node-Prozess mit WebSocket-Support nötig (z. B. Render Web Service, Fly.io, Railway, VPS). Start: `npm install && npm start`, Umgebungsvariablen siehe `.env.example` (`PORT` wird meist vom Anbieter gesetzt). Alternativ `Dockerfile`. HTTPS wird automatisch zu `wss://`. Eine Instanz hostet mehrere Arenen; bei mehr Last mehrere Instanzen mit Load-Balancer (Sticky Sessions) – nicht implementiert.

## Status (ehrlich)
- Getestet (automatisiert, 12 Tests grün): Masse/Radius, Geschwindigkeit, Teilung, Fressregeln, Masseabgabe, Merge, Viren, Sync zweier WebSocket-Clients, Reconnect, Matchmaking, Last (80 Spieler ≈ 3 ms/Tick inkl. Snapshots auf der Entwicklungsumgebung).
- **Nicht getestet**: echte Smartphones/Touch-Bedienung, Rendering im Browser, öffentliches Deployment, Latenz im Mobilnetz.
- **Nicht implementiert**: Client-Prediction (nur Interpolation/Glättung), Lag Compensation, binäres Protokoll (aktuell JSON), Minimap, Skins, weitere Modi.

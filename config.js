// Zentrale Physik-/Spielparameter. Werte mit (K) stammen aus Community-Dokumentation
// offener Agar.io-Server-Nachbauten, NICHT aus einer eigenen Messung am Original.
// Werte mit (A) sind Annahmen und müssen kalibriert werden.
export const CFG = {
  TICK_RATE: 30,            // Server-Simulationsrate (Hz)
  SEND_EVERY: 1,            // Snapshot alle N Ticks
  MAP: 6000,                // Arena-Kantenlänge (A)
  MAX_PLAYERS: Number(globalThis.process?.env?.MAX_PLAYERS) || 40,
  START_MASS: 20,           // (A)
  FOOD_COUNT: 700, FOOD_MASS: 1, FOOD_RADIUS: 10,
  VIRUS_COUNT: 12, VIRUS_MASS: 100, VIRUS_FEEDS: 7, VIRUS_SPLITS: 7, VIRUS_EAT_MIN: 130, // (A)
  SPEED_COEF: 2200, SPEED_EXP: -0.439, PLAYER_SPEED: 1, // px/s = COEF * r^EXP (K: 2.2*r^-0.439*40 px/Tick bei 25 Tick/s)
  EAT_RATIO: 1.25,          // Fresser braucht 25 % mehr Masse (K)
  EAT_OVERLAP: 0.4,         // Beute-Mittelpunkt muss tief genug im Fresser liegen (A)
  MIN_SPLIT_MASS: 36, MAX_CELLS: 16, SPLIT_SPEED: 1400, BOOST_DECAY: 4, // (K/A)
  MERGE_BASE: 30, MERGE_PER_MASS: 0.02,  // Sekunden bis Wiedervereinigung (K)
  EJECT_MIN: 35, EJECT_LOSS: 16, EJECT_MASS: 13, EJECT_SPEED: 900, EJECT_DECAY: 3, // (K)
  DECAY_RATE: 0.002, DECAY_MIN: 10,      // Masseverlust pro Sekunde (K)
  VIEW_HALF: 1000,          // halbe Sichtweite bei Zoom 1 für Server-Culling
  RECONNECT_GRACE: 10,      // Sekunden
};

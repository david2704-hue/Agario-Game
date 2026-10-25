import { CFG } from './config.js';
export const massToRadius = (m) => 10 * Math.sqrt(m);          // mass = r² / 100
export const radiusToMass = (r) => (r / 10) ** 2;
export const moveSpeed = (r, cfg = CFG) => cfg.SPEED_COEF * Math.pow(r, cfg.SPEED_EXP) * cfg.PLAYER_SPEED;
export const canEat = (em, pm, cfg = CFG) => em >= pm * cfg.EAT_RATIO;
export const overlapEats = (dist, re, rp, cfg = CFG) => dist < re - rp * cfg.EAT_OVERLAP;
export const cameraScale = (sumR) => Math.pow(Math.min(64 / Math.max(sumR, 1), 1), 0.4);
export const mergeDelay = (m, cfg = CFG) => cfg.MERGE_BASE + cfg.MERGE_PER_MASS * m;

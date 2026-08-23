/**
 * config.js — Ajustes globales del add-on Dreamcore.
 */

export const NAMESPACE = "dreamcore";

// ── Portal de entrada (Overworld) ───────────────────────────────────────────
export const PORTAL = {
  minDistance: 10,
  maxDistance: 35,
  checkInterval: 60,
  lifetimeSeconds: 600,
  maxActive: 3,
  spawnCooldownSeconds: 60,
  frameBlock: `${NAMESPACE}:portal_frame`,
  width: 5,
  height: 9,
  beamHeight: 80,
  beamInterval: 2,
  beamParticle: "minecraft:colored_flame_particle",
  beamColor: { red: 0.55, green: 0.95, blue: 1.0 },
  membraneDensity: 16,
  ambientSound: "minecraft:portal.portal",
  ambientInterval: 20,
  ambientVolume: 0.7,
};

// ── Portal de regreso (dentro de los niveles) ───────────────────────────────
// El ÚNICO camino de vuelta al Overworld sin morir.
export const RETURN_PORTAL = {
  minCellDist: 8,   // mín. celdas de distancia al spawn del nivel
  maxCellDist: 14,  // máx. → a 13 bloques/celda ≈ 104-182 bloques
  width: 5,
  height: 7,
  frameBlock:  "minecraft:end_stone_bricks",
  accentBlock: "minecraft:gold_block",
  baseBlock:   "minecraft:obsidian",
  particleColor: { red: 1.0, green: 0.85, blue: 0.2 }, // dorado
  hintAfterSec:    90,  // primer mensaje de ayuda
  compassAfterSec: 270, // dirección aproximada al portal
};

// ── Distorsión creciente (presión de tiempo sin expulsión forzada) ──────────
// Después de X minutos el mundo "se rompe" y causa daño continuo.
// La única salida sigue siendo el portal de regreso o morir.
export const DISTORTION = {
  startSec:          300,  //  5 min → empieza náusea leve
  maxSec:            900,  // 15 min → distorsión máxima
  damageSec:        1200,  // 20 min → daño por vacío
  damageIntervalSec:  30,  // cada 30 s aplica 1 corazón de daño
  sounds: ["dreamcore:heartbeat", "dreamcore:hum_loud", "dreamcore:music_box"],
};

// ── Generación infinita ─────────────────────────────────────────────────────
export const INFINITE = {
  cell:          12,    // tamaño interior de cada celda (bloques)
  wall:           1,    // grosor del muro compartido entre celdas
  floorY:        64,    // Y del suelo
  ceilOffset:     4,    // techo relativo al suelo (override por tema)
  genRadius:      4,    // celdas precargadas alrededor del jugador
  maxGenPerTick:  8,    // presupuesto de celdas por tick (móvil-friendly)
  tickInterval:   3,    // ticks entre pasadas de generación
  seedBase:   90210,
};

// ── Tick de estado ──────────────────────────────────────────────────────────
export const DREAM_TIMER = { tickInterval: 20 };

// ── Identificadores ─────────────────────────────────────────────────────────
export const LEVEL_PREFIX = `${NAMESPACE}:level_`;

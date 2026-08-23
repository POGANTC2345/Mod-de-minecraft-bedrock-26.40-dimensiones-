/**
 * returnPortalSystem.js — Portal de Regreso: el ÚNICO camino de vuelta al Overworld.
 *
 * Diseño:
 *   · Cada nivel tiene UNA celda de salida, calculada determinísticamente
 *     (mismo resultado siempre para el mismo nivel → la distancia varía entre
 *     8 y 14 celdas del punto de spawn = 104-182 bloques de exploración real).
 *   · El portal NO se construye al entrar al nivel; se construye cuando el
 *     generador infinito llega a esa celda (el jugador tiene que caminar hasta
 *     allá). levelBuilder llama a checkAndPlace() en cada celda nueva.
 *   · Visualmente distinto al de entrada: marco de end_stone_bricks, partículas
 *     doradas, postes de glowstone y base de obsidiana.
 *   · El tick detecta proximidad (sin colisiones complejas) → exitLevel.
 *   · El tick también emite pistas progresivas (texto) para guiar al jugador.
 */
import { system, world, MolangVariableMap } from "@minecraft/server";
import { RETURN_PORTAL, INFINITE, NAMESPACE } from "../config.js";
import { getLevelById } from "../levels/levelRegistry.js";
import { getDreamState, exitLevel } from "./dreamTimer.js";

const INF_STEP = INFINITE.cell + INFINITE.wall;

// levelId → { cx, cz }  (celda de salida absoluta)
const exitCells  = new Map();
// levelId → { x, y, z, dimId }  (portal ya colocado)
const placedPortals = new Map();
// playerId → last hint ms
const lastHintAt = new Map();

// ── Hash determinista ────────────────────────────────────────────────────────
function hash2(a, b, seed) {
  let h = (a * 374761393 + b * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = (h * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ── Celda de salida ──────────────────────────────────────────────────────────
/**
 * Llamado desde levelBuilder.prepareInfiniteSpawn() una vez conocemos las
 * coordenadas de spawn en celdas.
 */
export function initLevelExitCell(levelId, spawnCX, spawnCZ) {
  if (exitCells.has(levelId)) return;
  const seed = (levelId.charCodeAt(levelId.length - 2) * 997 + 13131) | 0;
  const h1 = hash2(spawnCX, spawnCZ, seed);
  const h2 = hash2(spawnCX + 1, spawnCZ + 1, seed + 7);
  const angle = h1 * Math.PI * 2;
  const dist  = RETURN_PORTAL.minCellDist +
                Math.floor(h2 * (RETURN_PORTAL.maxCellDist - RETURN_PORTAL.minCellDist + 1));
  exitCells.set(levelId, {
    cx: spawnCX + Math.round(Math.cos(angle) * dist),
    cz: spawnCZ + Math.round(Math.sin(angle) * dist),
  });
}

/**
 * Llamado por levelBuilder.generateCell().
 * Devuelve true y coloca el portal si ésta es la celda de salida y no existe aún.
 */
export function checkAndPlaceReturnPortal(levelId, dim, cx, cz, x0, z0, yF) {
  const ec = exitCells.get(levelId);
  if (!ec || ec.cx !== cx || ec.cz !== cz) return false;
  if (placedPortals.has(levelId)) return false; // ya colocado (jugador volvió)

  buildReturnPortalStructure(dim, x0, z0, yF);
  placedPortals.set(levelId, {
    x: x0, y: yF, z: z0,
    dimId: dim.id,
  });
  console.warn(`[Dreamcore] Portal de regreso colocado en ${levelId} @ (${x0}, ${yF}, ${z0})`);
  return true;
}

// ── Construcción del portal de regreso ───────────────────────────────────────
// Marco de 5×7 de end_stone_bricks, centrado en la celda.
// Base de obsidiana + postes de glowstone + cadena + soul_lantern colgando.
function buildReturnPortalStructure(dim, x0, z0, yF) {
  const { width, height, frameBlock, baseBlock, accentBlock } = RETURN_PORTAL;
  // Centro horizontal de la celda
  const cx = x0 + Math.floor((INFINITE.cell - width) / 2);  // ≈ x0+3
  const cz = z0 + Math.floor(INFINITE.cell / 2);             // ≈ z0+6

  function s(x, y, z, type) {
    try { const b = dim.getBlock({ x, y, z }); if (b) b.setType(type); } catch (_) {}
  }

  // Limpiar área del portal
  for (let dx = -1; dx <= width; dx++)
    for (let dy = 0; dy <= height + 2; dy++)
      s(cx + dx, yF + dy, cz, "minecraft:air");

  // ── Base (yF)
  for (let dx = 0; dx < width; dx++) s(cx + dx, yF, cz, baseBlock);
  s(cx - 1, yF, cz, accentBlock);
  s(cx + width, yF, cz, accentBlock);

  // ── Marco
  for (let dy = 1; dy <= height; dy++) {
    s(cx,           yF + dy, cz, frameBlock);
    s(cx + width - 1, yF + dy, cz, frameBlock);
  }
  for (let dx = 1; dx < width - 1; dx++) {
    s(cx + dx, yF + 1,      cz, frameBlock);
    s(cx + dx, yF + height, cz, frameBlock);
  }

  // ── Postes dorados a los lados
  for (let dy = 1; dy <= 3; dy++) {
    s(cx - 1, yF + dy, cz, "minecraft:chain");
    s(cx + width, yF + dy, cz, "minecraft:chain");
  }
  s(cx - 1,     yF + 4, cz, "minecraft:soul_lantern");
  s(cx + width, yF + 4, cz, "minecraft:soul_lantern");

  // ── Cadena + soul_lantern colgando en el centro
  s(cx + Math.floor(width / 2), yF + height - 1, cz, "minecraft:chain");
  s(cx + Math.floor(width / 2), yF + height - 2, cz, "minecraft:chain");
  s(cx + Math.floor(width / 2), yF + height - 3, cz, "minecraft:soul_lantern");

  // ── Acento en la base del marco (glowstone bajo columnas)
  s(cx,           yF, cz, "minecraft:glowstone");
  s(cx + width - 1, yF, cz, "minecraft:glowstone");
}

// ── Sistema de ticks ─────────────────────────────────────────────────────────
export function startReturnPortalSystem() {
  system.runInterval(tick,         15);  // detección + pistas
  system.runInterval(particleTick,  5);  // partículas doradas
}

function tick() {
  const now = Date.now();

  for (const player of world.getAllPlayers()) {
    const st = getDreamState(player);
    if (!st) continue;

    const portal = placedPortals.get(st.levelId);
    const elapsedSec = (now - st.enteredAt) / 1000;

    // ── Pistas progresivas ──────────────────────────────────────────────────
    const lastHint = lastHintAt.get(player.id) ?? 0;
    const hintCooldown = 60_000; // máx 1 pista por minuto

    if (elapsedSec >= RETURN_PORTAL.hintAfterSec && now - lastHint > hintCooldown) {
      let msg = null;
      if (!portal) {
        msg = "§7Sientes que hay una salida en algún lugar... sigue explorando.";
      } else if (elapsedSec >= RETURN_PORTAL.compassAfterSec) {
        // Dirección aproximada al portal ya colocado
        const dx = (portal.x + 2) - player.location.x;
        const dz = portal.z - player.location.z;
        const angle = Math.atan2(dz, dx) * 180 / Math.PI;
        const dirs = ["→ Este","↗","↑ Norte","↖","← Oeste","↙","↓ Sur","↘"];
        const dir = dirs[Math.round(((angle + 360) % 360) / 45) % 8];
        const dist = Math.round(Math.sqrt(dx * dx + dz * dz));
        msg = `§6✦ El portal de regreso está ~${dist} bloques ${dir}`;
      } else {
        msg = "§7El portal de regreso está cerca... pero tendrás que encontrarlo.";
      }
      if (msg) {
        try { player.sendMessage(msg); } catch (_) {}
        lastHintAt.set(player.id, now);
      }
    }

    // ── Detección de entrada al portal de regreso ──────────────────────────
    if (!portal) continue;
    if (portal.dimId !== player.dimension.id) continue;

    const { width, height } = RETURN_PORTAL;
    const cx = portal.x + Math.floor((INFINITE.cell - width) / 2);
    const cz = portal.z + Math.floor(INFINITE.cell / 2);
    const yF = portal.y;

    const px = player.location.x, py = player.location.y, pz = player.location.z;
    const inX = px >= cx + 0.5 && px <= cx + width - 1.5;
    const inZ = Math.abs(pz - cz) <= 1.2;
    const inY = py >= yF + 0.5 && py <= yF + height + 1;

    if (inX && inZ && inY) {
      // ¡Encontró el portal!
      try {
        player.camera.fade({
          fadeColor: { red: 1, green: 0.9, blue: 0.3 },
          fadeTime: { fadeInTime: 0.6, holdTime: 0.3, fadeOutTime: 0.8 },
        });
      } catch (_) {}
      player.playSound("minecraft:portal.travel", { volume: 1.5, pitch: 0.6 });
      player.onScreenDisplay.setTitle("§e✦ Escapaste ✦", {
        subtitle: "El sueño te libera...",
        fadeInDuration: 10, stayDuration: 55, fadeOutDuration: 25,
      });
      lastHintAt.delete(player.id);
      exitLevel(player, false);
    }
  }
}

function particleTick() {
  const map = new MolangVariableMap();
  map.setColorRGB("variable.color", RETURN_PORTAL.particleColor);
  const t = Date.now() * 0.003;
  const { width, height } = RETURN_PORTAL;

  for (const [, portal] of placedPortals) {
    try {
      const dim  = world.getDimension(portal.dimId);
      // Verificar si hay jugadores en esta dimensión antes de spawnear partículas
      if (dim.getPlayers().length === 0) continue;

      const cx = portal.x + Math.floor((INFINITE.cell - width) / 2);
      const cz = portal.z + Math.floor(INFINITE.cell / 2);
      const yF = portal.y;
      const midX = cx + width / 2, midY = yF + height / 2;

      for (let i = 0; i < 12; i++) {
        const angle = t + i * (Math.PI * 2 / 12);
        const hx = Math.sin(angle) * (width / 2 - 0.5);
        const hy = height / 2 + Math.cos(angle * 0.8) * (height / 2 - 0.7);
        dim.spawnParticle("minecraft:colored_flame_particle", {
          x: midX + hx * (0.4 + Math.random() * 0.5),
          y: yF + hy + (Math.random() - 0.5) * 0.5,
          z: cz + (Math.random() - 0.5) * 0.4,
        }, map);
      }
    } catch (_) {}
  }
}

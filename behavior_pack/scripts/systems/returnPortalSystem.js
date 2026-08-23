/**
 * returnPortalSystem.js — Portal de Regreso: el ÚNICO camino de vuelta al Overworld.
 *
 * Diseño mejorado:
 *   · Cada nivel tiene UNA celda de salida calculada determinísticamente.
 *   · Emite una señal visual masiva tipo "Faro" (Beacon beam ultra brillante con partículas
 *     de end_rod y flamas doradas que ascienden hasta el cielo) visible desde cualquier distancia.
 *   · Detecta proximidad y devuelve al jugador al Overworld de manera limpia y segura.
 */
import { system, world, MolangVariableMap } from "@minecraft/server";
import { RETURN_PORTAL, INFINITE, NAMESPACE } from "../config.js";
import { getLevelById } from "../levels/levelRegistry.js";
import { getDreamState, exitLevel } from "./dreamTimer.js";

const INF_STEP = INFINITE.cell + INFINITE.wall;

const exitCells  = new Map();
const placedPortals = new Map();
const lastHintAt = new Map();

function hash2(a, b, seed) {
  let h = (a * 374761393 + b * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = (h * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function initLevelExitCell(levelId, spawnCX, spawnCZ) {
  if (exitCells.has(levelId)) return;
  const seed = (levelId.charCodeAt(levelId.length - 2) * 997 + 13131) | 0;
  const h1 = hash2(spawnCX, spawnCZ, seed);
  const h2 = hash2(spawnCX + 1, spawnCZ + 1, seed + 7);
  const angle = h1 * Math.PI * 2;
  // Distancia optimizada (3 a 7 celdas) para asegurar que el jugador pueda encontrarlo sin frustración
  const dist  = 3 + Math.floor(h2 * 5);
  exitCells.set(levelId, {
    cx: spawnCX + Math.round(Math.cos(angle) * dist),
    cz: spawnCZ + Math.round(Math.sin(angle) * dist),
  });
}

export function checkAndPlaceReturnPortal(levelId, dim, cx, cz, x0, z0, yF) {
  const ec = exitCells.get(levelId);
  if (!ec || ec.cx !== cx || ec.cz !== cz) return false;
  if (placedPortals.has(levelId)) return false;

  buildReturnPortalStructure(dim, x0, z0, yF);
  placedPortals.set(levelId, {
    x: x0, y: yF, z: z0,
    dimId: dim.id,
  });
  console.warn(`[Dreamcore] Portal de regreso colocado en ${levelId} @ (${x0}, ${yF}, ${z0})`);
  return true;
}

function buildReturnPortalStructure(dim, x0, z0, yF) {
  const { width, height, frameBlock, baseBlock, accentBlock } = RETURN_PORTAL;
  const cx = x0 + Math.floor((INFINITE.cell - width) / 2);
  const cz = z0 + Math.floor(INFINITE.cell / 2);

  function s(x, y, z, type) {
    try { const b = dim.getBlock({ x, y, z }); if (b) b.setType(type); } catch (_) {}
  }

  for (let dx = -1; dx <= width; dx++)
    for (let dy = 0; dy <= height + 3; dy++)
      s(cx + dx, yF + dy, cz, "minecraft:air");

  for (let dx = 0; dx < width; dx++) s(cx + dx, yF, cz, baseBlock);
  s(cx - 1, yF, cz, accentBlock);
  s(cx + width, yF, cz, accentBlock);

  for (let dy = 1; dy <= height; dy++) {
    s(cx,           yF + dy, cz, frameBlock);
    s(cx + width - 1, yF + dy, cz, frameBlock);
  }
  for (let dx = 1; dx < width - 1; dx++) {
    s(cx + dx, yF + 1,      cz, frameBlock);
    s(cx + dx, yF + height, cz, frameBlock);
  }

  for (let dy = 1; dy <= 3; dy++) {
    s(cx - 1, yF + dy, cz, "minecraft:chain");
    s(cx + width, yF + dy, cz, "minecraft:chain");
  }
  s(cx - 1,     yF + 4, cz, "minecraft:soul_lantern");
  s(cx + width, yF + 4, cz, "minecraft:soul_lantern");

  s(cx + Math.floor(width / 2), yF + height - 1, cz, "minecraft:chain");
  s(cx + Math.floor(width / 2), yF + height - 2, cz, "minecraft:chain");
  s(cx + Math.floor(width / 2), yF + height - 3, cz, "minecraft:soul_lantern");

  s(cx,           yF, cz, "minecraft:glowstone");
  s(cx + width - 1, yF, cz, "minecraft:glowstone");
}

export function startReturnPortalSystem() {
  system.runInterval(tick,         15);
  system.runInterval(particleTick,  3); // Más frecuente para que el faro sea sumamente fluido
}

function tick() {
  const now = Date.now();

  for (const player of world.getAllPlayers()) {
    const st = getDreamState(player);
    if (!st) continue;

    const portal = placedPortals.get(st.levelId);
    const elapsedSec = (now - st.enteredAt) / 1000;

    const lastHint = lastHintAt.get(player.id) ?? 0;
    const hintCooldown = 25_000; // Pistas más frecuentes

    if (elapsedSec >= 5 && now - lastHint > hintCooldown) {
      let msg = null;
      if (!portal) {
        msg = "§7El portal de regreso se está materializando cerca... sigue explorando.";
      } else {
        const dx = (portal.x + 2) - player.location.x;
        const dz = portal.z - player.location.z;
        const angle = Math.atan2(dz, dx) * 180 / Math.PI;
        const dirs = ["→ Este","↗","↑ Norte","↖","← Oeste","↙","↓ Sur","↘"];
        const dir = dirs[Math.round(((angle + 360) % 360) / 45) % 8];
        const dist = Math.round(Math.sqrt(dx * dx + dz * dz));
        msg = `§e✦ ¡El Faro del Portal de Regreso brilla a ~${dist} bloques ${dir}! Sigue la columna de luz.`;
      }
      if (msg) {
        try { player.sendMessage(msg); } catch (_) {}
        lastHintAt.set(player.id, now);
      }
    }

    if (!portal) continue;
    if (portal.dimId !== player.dimension.id) continue;

    const { width, height } = RETURN_PORTAL;
    const cx = portal.x + Math.floor((INFINITE.cell - width) / 2);
    const cz = portal.z + Math.floor(INFINITE.cell / 2);
    const yF = portal.y;

    const px = player.location.x, py = player.location.y, pz = player.location.z;
    const inX = px >= cx + 0.5 && px <= cx + width - 1.5;
    const inZ = Math.abs(pz - cz) <= 1.5;
    const inY = py >= yF + 0.5 && py <= yF + height + 2;

    if (inX && inZ && inY) {
      try {
        player.camera.fade({
          fadeColor: { red: 1, green: 0.9, blue: 0.3 },
          fadeTime: { fadeInTime: 0.6, holdTime: 0.3, fadeOutTime: 0.8 },
        });
      } catch (_) {}
      player.playSound("dreamcore:return_found", { volume: 1.5, pitch: 1 });
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
      if (dim.getPlayers().length === 0) continue;

      const cx = portal.x + Math.floor((INFINITE.cell - width) / 2);
      const cz = portal.z + Math.floor(INFINITE.cell / 2);
      const yF = portal.y;
      const midX = cx + width / 2;

      // 1) Anillo de flamas doradas alrededor del portal
      for (let i = 0; i < 16; i++) {
        const angle = t + i * (Math.PI * 2 / 16);
        const hx = Math.sin(angle) * (width / 2 - 0.5);
        const hy = height / 2 + Math.cos(angle * 0.8) * (height / 2 - 0.7);
        dim.spawnParticle("minecraft:colored_flame_particle", {
          x: midX + hx * (0.4 + Math.random() * 0.5),
          y: yF + hy + (Math.random() - 0.5) * 0.5,
          z: cz + (Math.random() - 0.5) * 0.4,
        }, map);
      }

      // 2) Columna tipo "Faro" (Beacon beam vertical masivo) desde el portal hasta 60 bloques de alto
      for (let py = yF + height; py <= yF + 60; py += 3) {
        dim.spawnParticle("minecraft:endrod", {
          x: midX + (Math.random() - 0.5) * 0.6,
          y: py,
          z: cz + (Math.random() - 0.5) * 0.6,
        });
        dim.spawnParticle("minecraft:colored_flame_particle", {
          x: midX + (Math.random() - 0.5) * 0.4,
          y: py,
          z: cz + (Math.random() - 0.5) * 0.4,
        }, map);
      }
    } catch (_) {}
  }
}

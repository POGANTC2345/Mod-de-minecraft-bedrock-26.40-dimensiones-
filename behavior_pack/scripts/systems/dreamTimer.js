/**
 * dreamTimer.js — Estado del sueño + protección contra caídas al vacío (regreso al Overworld).
 *
 * CAMBIOS:
 *   · Se preserva el returnLoc original al cambiar de nivel con el control,
 *     evitando que al pulsar "Despertar" se vuelva a la dimensión anterior en vez del Overworld.
 *   · Si el jugador cae al vacío, es devuelto automáticamente al Overworld (despertar).
 *   · Sonido inmersivo al entrar.
 */
import { system, world } from "@minecraft/server";
import { DREAM_TIMER, DISTORTION, NAMESPACE } from "../config.js";
import { getLevelById } from "../levels/levelRegistry.js";
import { buildLevel, getBuiltLevel } from "./levelBuilder.js";
import { levelTarget } from "./dimensionResolver.js";
import { spawnMobsForLevel } from "./voidSystem.js";

const RETURN_KEY = `${NAMESPACE}:return`;

const state = new Map(); // playerId → dreamState
const busy  = new Set();

export function getDreamState(player) { return state.get(player.id) ?? null; }

export function startDreamTimer() {
  system.runInterval(tick, DREAM_TIMER.tickInterval);
}

function tell(player, msg) {
  try { player.sendMessage(msg); } catch (_) {}
}

// ── Entrada al sueño ─────────────────────────────────────────────────────────
export async function enterLevel(player, levelId, entryPoint) {
  const level = getLevelById(levelId);
  if (!level) { tell(player, "§c[Dreamcore] Nivel no encontrado."); return; }
  if (busy.has(player.id)) return;
  busy.add(player.id);

  try {
    const t      = levelTarget(level);
    const record = await buildLevel(level);

    // FIX: Preservar el returnLoc original si ya estábamos en un sueño,
    // para que al usar "Despertar / Volver al Overworld" siempre regrese al Overworld
    // original y no a la dimensión intermedia anterior.
    const currentSt = state.get(player.id);
    const returnLoc = currentSt?.returnLoc ?? {
      dimId: player.dimension.id,
      x: entryPoint.x, y: entryPoint.y, z: entryPoint.z,
    };
    player.setDynamicProperty(RETURN_KEY, JSON.stringify(returnLoc));

    state.set(player.id, {
      levelId:     level.id,
      targetDimId: t.dim.id,
      fallback:    t.fallback,
      targetX:     t.centerX,
      targetZ:     t.centerZ,
      floorY:      t.floorY,
      returnLoc,
      enteredAt:   Date.now(),
      distorting:  false,
      progress:    0,
    });

    // Fade de entrada
    try {
      player.camera.fade({
        fadeColor: { red: 0, green: 0, blue: 0 },
        fadeTime: { fadeInTime: 0.5, holdTime: 0.2, fadeOutTime: 0.6 },
      });
    } catch (_) {}

    player.teleport(record.spawn, { dimension: t.dim });

    try { player.runCommandAsync(`fog @s push ${level.theme.fog}`); } catch (_) {}
    player.playSound("dreamcore:enter_level", { volume: 1.2, pitch: 1 });
    player.playSound("minecraft:portal.travel", { volume: 1, pitch: 1 });

    player.onScreenDisplay.setTitle(level.name, {
      subtitle: "Encuentra el portal de regreso para escapar.",
      fadeInDuration: 10, stayDuration: 55, fadeOutDuration: 20,
    });

    if (level.inhabited) spawnMobsForLevel(level, t.dim, record.spawn);

    // Pista retardada (5 s después)
    system.runTimeout(() => {
      if (getDreamState(player)?.levelId === level.id) {
        tell(player, "§8El portal de regreso está escondido y emite una señal luminosa...");
      }
    }, 100);

    tell(player, `§b[Dreamcore] Entraste a ${level.name}`);
  } catch (err) {
    console.error("[Dreamcore] enterLevel falló:", err);
    tell(player, "§c[Dreamcore] No se pudo entrar: " + (err?.message ?? err));
    state.delete(player.id);
    try { player.removeDynamicProperty(RETURN_KEY); } catch (_) {}
  } finally {
    busy.delete(player.id);
  }
}

// ── Tick de monitoreo ────────────────────────────────────────────────────────
function tick() {
  for (const player of world.getAllPlayers()) {
    let st = state.get(player.id);

    if (!st) {
      if (player.dimension.id.startsWith(NAMESPACE + ":level_"))
        restoreState(player, player.dimension.id);
      continue;
    }

    // ¿Salió del sueño por su cuenta (muerte, comando, etc.)?
    if (!isInDream(player, st)) { cleanupState(player); continue; }

    const elapsedSec = (Date.now() - st.enteredAt) / 1000;

    // ── Protección contra caídas al vacío: regresar al Overworld ───────────
    const safeY = (st.floorY ?? 64) - 15;
    if (player.location.y < safeY) {
      tell(player, "§c[Dreamcore] ¡Caíste al vacío y despertaste en el Overworld!");
      exitLevel(player, false);
      continue;
    }

    // ── Progreso de distorsión (tiempo-dependiente, sin expulsión) ─────────
    const ds = DISTORTION.startSec, dm = DISTORTION.maxSec;
    if (elapsedSec < ds) {
      st.distorting = false;
      st.progress   = 0;
    } else {
      st.distorting = true;
      st.progress   = Math.min(1, (elapsedSec - ds) / (dm - ds));
    }
  }
}

function isInDream(player, st) {
  if (player.dimension.id !== st.targetDimId) return false;
  if (st.fallback) {
    if (Math.abs(player.location.x - st.targetX) > 10000) return false;
    if (Math.abs(player.location.z - st.targetZ) > 10000) return false;
  }
  return true;
}

function cleanupState(player) {
  state.delete(player.id);
  try { player.removeDynamicProperty(RETURN_KEY); } catch (_) {}
  try { player.runCommandAsync("fog @s remove"); }  catch (_) {}
  try { player.stopMusic(); }  catch (_) {}
  try { player.camera.clear(); } catch (_) {}
}

function restoreState(player, dimId) {
  let returnLoc = null;
  try { const raw = player.getDynamicProperty(RETURN_KEY); if (raw) returnLoc = JSON.parse(raw); }
  catch (_) {}
  if (!returnLoc) returnLoc = { dimId: "minecraft:overworld", ...world.getDefaultSpawnLocation() };

  const t = levelTarget({ id: dimId, index: parseInt(dimId.split("_").pop() ?? "0", 10) || 0 });
  state.set(player.id, {
    levelId:     dimId,
    targetDimId: t.dim.id,
    fallback:    t.fallback,
    targetX:     t.centerX,
    targetZ:     t.centerZ,
    floorY:      t.floorY,
    returnLoc,
    enteredAt:   Date.now(),
    distorting:  false,
    progress:    0,
  });
}

// ── Salida ("escapar") ────────────────────────────────────────────────────────
export function exitLevel(player, wokeUp) {
  const st = state.get(player.id);
  let returnLoc = st?.returnLoc;
  if (!returnLoc) {
    try { const raw = player.getDynamicProperty(RETURN_KEY); if (raw) returnLoc = JSON.parse(raw); }
    catch (_) {}
  }

  cleanupState(player);

  if (returnLoc) {
    try {
      player.teleport(
        { x: returnLoc.x, y: returnLoc.y, z: returnLoc.z },
        { dimension: world.getDimension(returnLoc.dimId) }
      );
    } catch (_) {
      try { player.teleport({ x: returnLoc.x, y: returnLoc.y, z: returnLoc.z },
            { dimension: world.getDimension("minecraft:overworld") }); } catch (_2) {}
    }
  }

  try {
    player.camera.fade({
      fadeColor: { red: 1, green: 1, blue: 1 },
      fadeTime: { fadeInTime: 0.4, holdTime: 0.2, fadeOutTime: 0.6 },
    });
  } catch (_) {}

  player.playSound("dreamcore:wake", { volume: 1.2, pitch: 1 });
  player.onScreenDisplay.setTitle("Despertaste.", {
    subtitle: "Has vuelto a la realidad del Overworld.",
    fadeInDuration: 15, stayDuration: 60, fadeOutDuration: 25,
  });
}

/**
 * portalSystem.js — Portales dinámicos AVANZADOS (v2, funcionales).
 *
 * Portal grande e imponente que:
 *   · aparece procedimentalmente a 10–30 bloques del jugador (Overworld),
 *   · proyecta un HAZ DE LUZ vertical hacia el cielo (efecto faro),
 *   · emite sonido ambiente (zumbido de portal) para localizarse de lejos,
 *   · tiene una "membrana" densa y arremolinada de partículas (caminable),
 *   · el marco EMITE LUZ (activo, visible de noche),
 *   · teletransporta de forma FIABLE al entrar.
 *
 * FIX v2: la detección de entrada usaba la posición Y de los pies contra el
 * interior del marco (que empieza 2 bloques más arriba), así que NUNCA se
 * activaba. Ahora se detecta correctamente el cuerpo del jugador cruzando.
 */
import { system, world, MolangVariableMap } from "@minecraft/server";
import { PORTAL } from "../config.js";
import { getRandomLevelId, getSequentialLevelId } from "../levels/levelRegistry.js";
import { enterLevel } from "./dreamTimer.js";

// Modo de selección de nivel: "random" | "sequential".
// Sequential = sin repetir niveles hasta haber pasado por todos.
const MODE = "sequential";

const activePortals = [];
let nextPortalId = 1;
let lastSpawnAt = 0;
let sequentialPointer = 0;
let beamTick = 0;

// Anti-doble-teleport: jugadores en plena transición + cooldown de 2 s.
const teleporting = new Set();
const lastEntryAt = new Map();

export function startPortalSystem() {
  system.runInterval(tickSpawn, PORTAL.checkInterval);
  system.runInterval(tickPortals, 3); // más frecuente → partículas más densas
}

// ── Generación ──────────────────────────────────────────────────────────────
function tickSpawn() {
  const now = Date.now() / 1000;
  if (now - lastSpawnAt < PORTAL.spawnCooldownSeconds) return;
  if (activePortals.length >= PORTAL.maxActive) return;

  const dim = world.getDimension("minecraft:overworld");
  for (const player of dim.getPlayers()) {
    if (activePortals.length >= PORTAL.maxActive) break;

    const pos = tryFindPortalSpot(dim, player);
    if (!pos) continue;

    const portal = {
      id: nextPortalId++,
      x0: pos.x,
      y0: pos.y,
      z0: pos.z,
      spawnedAt: now,
      lastAmbientAt: 0,
      blocks: [], // bloques del marco (para limpiarlos al cerrar)
      removed: false,
    };
    buildPortalStructure(dim, portal);

    activePortals.push(portal);
    lastSpawnAt = now;

    // Anuncio de aparición (sonido de portal vanilla, fiable).
    world.playSound("minecraft:portal.trigger", portalCenter(portal), {
      volume: 1.0,
      pitch: 0.7,
    });
  }
}

// FIX: antes se exigía que los 5×9 bloques del hueco fueran TODOS
// "minecraft:air" exacto. Eso casi nunca se cumple fuera de una llanura
// perfectamente rasa: hojas, hierba alta, nieve en el suelo, etc. bastaban
// para descartar el punto, así que en bosques/colinas (como en la captura)
// tryFindPortalSpot devolvía null una y otra vez y el portal automático
// prácticamente nunca aparecía. Ahora se acepta cualquier bloque
// "atravesable" (incluye hojas y vegetación) y esos bloques se despejan al
// construir el marco (ver buildPortalStructure).
const PASSABLE_TYPES = new Set([
  "minecraft:air",
  "minecraft:short_grass",
  "minecraft:tall_grass",
  "minecraft:fern",
  "minecraft:large_fern",
  "minecraft:snow_layer",
  "minecraft:vine",
  "minecraft:dead_bush",
  "minecraft:sweet_berry_bush",
  "minecraft:oak_leaves",
  "minecraft:spruce_leaves",
  "minecraft:birch_leaves",
  "minecraft:jungle_leaves",
  "minecraft:acacia_leaves",
  "minecraft:dark_oak_leaves",
  "minecraft:cherry_leaves",
  "minecraft:mangrove_leaves",
  "minecraft:azalea_leaves",
  "minecraft:flowering_azalea_leaves",
]);

function isPassable(block) {
  if (!block) return false;
  const id = block.typeId;
  return PASSABLE_TYPES.has(id) || id.endsWith("_leaves");
}

function tryFindPortalSpot(dim, player) {
  const angle = Math.random() * Math.PI * 2;
  const dist = PORTAL.minDistance + Math.random() * (PORTAL.maxDistance - PORTAL.minDistance);

  const px = Math.floor(player.location.x + Math.cos(angle) * dist);
  const pz = Math.floor(player.location.z + Math.sin(angle) * dist);
  const y = findSurfaceY(dim, px, pz, Math.floor(player.location.y) + 8);
  if (y == null) return null;

  // Exige espacio "atravesable" (aire, hojas, plantas...) para todo el marco + interior.
  for (let hx = 0; hx < PORTAL.width; hx++) {
    for (let hy = 1; hy <= PORTAL.height; hy++) {
      const b = dim.getBlock({ x: px + hx, y: y + hy, z: pz });
      if (!isPassable(b)) return null;
    }
  }
  return { x: px, y, z: pz };
}

function findSurfaceY(dim, x, z, startY) {
  for (let y = startY; y > -60; y--) {
    const b = dim.getBlock({ x, y, z });
    if (b && b.typeId !== "minecraft:air" && b.typeId !== "minecraft:water") return y;
  }
  return null;
}

// ── Construcción del marco ──────────────────────────────────────────────────
function buildPortalStructure(dim, portal) {
  const { width, height, frameBlock } = PORTAL;
  const x0 = portal.x0, y0 = portal.y0, z0 = portal.z0;

  // Limpiar área incluyendo espacio para los postes laterales
  for (let hx = -1; hx <= width; hx++) {
    for (let hy = 0; hy <= height + 2; hy++) {
      const b = dim.getBlock({ x: x0 + hx, y: y0 + hy, z: z0 });
      if (b && b.typeId !== "minecraft:air") b.setType("minecraft:air");
    }
  }

  // ── Altar de obsidiana bajo el marco (a nivel de suelo)
  for (let xx = 0; xx < width; xx++)
    place(dim, portal, x0 + xx, y0, z0, "minecraft:polished_blackstone");

  // ── Marco del portal
  for (let yy = 1; yy <= height; yy++) {
    place(dim, portal, x0,           y0 + yy, z0, frameBlock);
    place(dim, portal, x0 + width - 1, y0 + yy, z0, frameBlock);
  }
  for (let xx = 1; xx <= width - 2; xx++) {
    place(dim, portal, x0 + xx, y0 + 1,      z0, frameBlock);
    place(dim, portal, x0 + xx, y0 + height, z0, frameBlock);
  }

  // ── Postes con cadena y soul_lantern a los lados del marco
  place(dim, portal, x0 - 1, y0 + 1, z0, "minecraft:chain");
  place(dim, portal, x0 - 1, y0 + 2, z0, "minecraft:chain");
  place(dim, portal, x0 - 1, y0 + 3, z0, "minecraft:chain");
  place(dim, portal, x0 - 1, y0 + 4, z0, "minecraft:soul_lantern");

  place(dim, portal, x0 + width, y0 + 1, z0, "minecraft:chain");
  place(dim, portal, x0 + width, y0 + 2, z0, "minecraft:chain");
  place(dim, portal, x0 + width, y0 + 3, z0, "minecraft:chain");
  place(dim, portal, x0 + width, y0 + 4, z0, "minecraft:soul_lantern");

  // ── Cadena + soul_lantern colgando en el centro (efecto de altar)
  const midX = x0 + Math.floor(width / 2);
  place(dim, portal, midX, y0 + height - 1, z0, "minecraft:chain");
  place(dim, portal, midX, y0 + height - 2, z0, "minecraft:chain");
  place(dim, portal, midX, y0 + height - 3, z0, "minecraft:soul_lantern");
}

function place(dim, portal, x, y, z, type) {
  dim.getBlock({ x, y, z }).setType(type);
  portal.blocks.push({ x, y, z });
}

function portalCenter(portal) {
  return {
    x: portal.x0 + PORTAL.width / 2,
    y: portal.y0 + PORTAL.height / 2,
    z: portal.z0 + 0.5,
  };
}

function clearStructure(dim, portal) {
  for (const b of portal.blocks) {
    dim.getBlock({ x: b.x, y: b.y, z: b.z }).setType("minecraft:air");
  }
}

// ── Tick de portales: haz, partículas, sonido, entrada ──────────────────────
function tickPortals() {
  const now = Date.now() / 1000;
  beamTick++;
  const dim = world.getDimension("minecraft:overworld");

  for (const portal of activePortals) {
    if (portal.removed) continue;

    // 1) Caducidad.
    if (now - portal.spawnedAt > PORTAL.lifetimeSeconds) {
      portal.removed = true;
      clearStructure(dim, portal);
      continue;
    }

    // FIX: la detección de entrada va PRIMERO y aislada en su propio
    // try/catch. Antes iba después de las partículas (spawnBeam /
    // spawnMembrane); si una de ellas lanzaba un error (por ejemplo, un ID
    // de partícula inválido), el resto de la función se cortaba y la
    // detección de entrada de ESE portal no se llegaba a ejecutar NUNCA en
    // ningún tick — el jugador podía cruzar el marco caminando y no pasaba
    // nada. Ahora un fallo cosmético (partícula/sonido) no puede impedir
    // que teletransportar al jugador siga funcionando.

    // 2) Detección de entrada (prioridad: siempre debe funcionar).
    let entered = false;
    for (const player of dim.getPlayers()) {
      if (isInsidePortal(player, portal)) {
        triggerEntry(player, portal);
        portal.removed = true;
        clearStructure(dim, portal);
        entered = true;
        break;
      }
    }
    if (entered) continue;

    // 3) Haz de luz hacia el cielo (cosmético, no debe romper nada más).
    if (beamTick % PORTAL.beamInterval === 0) {
      try { spawnBeam(dim, portal); } catch (_) { /* noop: solo estética */ }
    }

    // 4) Membrana densa y arremolinada (cosmético).
    try { spawnMembrane(dim, portal); } catch (_) { /* noop: solo estética */ }

    // 5) Sonido ambiente periódico (zumbido de portal vanilla, fiable).
    if (now - portal.lastAmbientAt > PORTAL.ambientInterval / 20) {
      try {
        world.playSound(PORTAL.ambientSound, portalCenter(portal), {
          volume: PORTAL.ambientVolume,
          pitch: 0.85,
        });
      } catch (_) { /* noop */ }
      portal.lastAmbientAt = now;
    }
  }

  // Compactar la lista.
  const remaining = activePortals.filter((p) => !p.removed);
  activePortals.length = 0;
  activePortals.push(...remaining);
}

function spawnBeam(dim, portal) {
  const map = new MolangVariableMap();
  map.setColorRGB("variable.color", PORTAL.beamColor);

  const cx = portal.x0 + PORTAL.width / 2;
  const cz = portal.z0 + 0.5;
  const baseY = portal.y0 + PORTAL.height + 1;

  // 2 partículas por bloque + jitter → haz denso y luminoso.
  for (let i = 0; i <= PORTAL.beamHeight; i++) {
    for (let k = 0; k < 2; k++) {
      dim.spawnParticle(
        PORTAL.beamParticle,
        {
          x: cx + (Math.random() - 0.5) * 0.5,
          y: baseY + i + 0.5,
          z: cz + (Math.random() - 0.5) * 0.5,
        },
        map
      );
    }
  }
}

function spawnMembrane(dim, portal) {
  const map = new MolangVariableMap();
  map.setColorRGB("variable.color", PORTAL.beamColor);

  const cx = portal.x0 + PORTAL.width / 2;
  const cz = portal.z0 + 0.5;

  // Vórtice: partículas repartidas por todo el interior, con rotación temporal.
  for (let i = 0; i < PORTAL.membraneDensity; i++) {
    const t = beamTick * 0.25 + i * 1.7;
    const hx = Math.sin(t) * (PORTAL.width / 2 - 0.8);
    const hy = PORTAL.height / 2 + Math.cos(t * 0.6) * (PORTAL.height / 2 - 0.8);

    const x = cx + hx * (0.3 + Math.random() * 0.7);
    const y = portal.y0 + hy + (Math.random() - 0.5);
    const z = cz + (Math.random() - 0.5) * 0.6;

    // Mezcla: partículas de color + motas de portal moradas (clásico).
    // FIX: "minecraft:portal_directional" no es un ID de partícula válido
    // en Bedrock (no existe en la lista vanilla), así que spawnParticle
    // lanzaba un error cada vez que le tocaba usarse (~40% de las llamadas,
    // en cada una de las 14 partículas por tick). Como esto ocurría ANTES
    // de la detección de entrada en el código original, cortaba el tick
    // entero. Se sustituye por "minecraft:basic_portal_particle" (válida).
    const effect = Math.random() < 0.6 ? PORTAL.beamParticle : "minecraft:basic_portal_particle";
    dim.spawnParticle(effect, { x, y, z }, map);
  }
}

// ── Detección de entrada (CORREGIDA) ────────────────────────────────────────
function isInsidePortal(player, portal) {
  const x = player.location.x;
  const feetY = player.location.y; // pies del jugador
  const z = player.location.z;

  // Interior del marco: columnas x0+1 .. x0+(width-2).
  const insideX = x >= portal.x0 + 0.6 && x <= portal.x0 + PORTAL.width - 1.4;
  const insideZ = Math.abs(z - (portal.z0 + 0.5)) <= 0.9;

  // FIX: los pies están en y0+1 (suelo). Aceptamos desde el suelo hasta el
  // techo del marco, para que cruzar caminando SIEMPRE dispare la entrada.
  const insideY = feetY >= portal.y0 + 0.5 && feetY <= portal.y0 + PORTAL.height + 1;

  return insideX && insideY && insideZ;
}

// ── Entrada al sueño ────────────────────────────────────────────────────────
function triggerEntry(player, portal) {
  if (teleporting.has(player.id)) return;
  const now = Date.now();
  if (lastEntryAt.has(player.id) && now - lastEntryAt.get(player.id) < 2000) return;

  teleporting.add(player.id);
  lastEntryAt.set(player.id, now);

  const levelId =
    MODE === "sequential" ? getSequentialLevelId(sequentialPointer++) : getRandomLevelId();

  const returnLoc = {
    x: portal.x0 + PORTAL.width / 2,
    y: portal.y0 + 1,
    z: portal.z0 + 0.5,
  };

  // Sonido de teletransporte (fiable, vanilla).
  player.playSound("minecraft:portal.travel", { volume: 1, pitch: 1 });

  enterLevel(player, levelId, returnLoc).finally(() => teleporting.delete(player.id));
}

/**
 * Fuerza la aparición de un portal cerca del jugador (para pruebas y para el
 * "Control de los Mundos").
 */
export function forceSpawnPortal(player) {
  const dim = player.dimension;
  if (dim.id !== "minecraft:overworld") {
    try { player.sendMessage("§c[Dreamcore] El portal solo aparece en el Overworld."); } catch (_) {}
    return;
  }

  const pos = tryFindPortalSpot(dim, player);
  if (!pos) {
    try { player.sendMessage("§c[Dreamcore] No hay espacio libre cerca para el portal."); } catch (_) {}
    return;
  }

  const portal = {
    id: nextPortalId++,
    x0: pos.x,
    y0: pos.y,
    z0: pos.z,
    spawnedAt: Date.now() / 1000,
    lastAmbientAt: 0,
    blocks: [],
    removed: false,
  };
  buildPortalStructure(dim, portal);
  activePortals.push(portal);

  world.playSound("minecraft:portal.trigger", portalCenter(portal), { volume: 1, pitch: 0.7 });
  try { player.sendMessage("§b[Dreamcore] Portal invocado cerca de ti."); } catch (_) {}
}

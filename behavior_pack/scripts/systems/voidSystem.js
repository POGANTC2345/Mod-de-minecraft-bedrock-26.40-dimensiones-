/**
 * voidSystem.js — Control de población de los niveles.
 *
 * Regla Dreamcore: al menos el 40% de los niveles está COMPLETAMENTE VACÍO.
 * En esos niveles bloqueamos el spawn de cualquier mob (vanilla o custom):
 * el terror viene solo del sonido y de la paranoia.
 *
 * También contiene la lógica que puebla los niveles "habitados" con mobs
 * de terror psicológico.
 */
import { world } from "@minecraft/server";
import { getLevelById } from "../levels/levelRegistry.js";

const ALLOWED_TYPES = new Set(["minecraft:player"]);

export function startVoidSystem() {
  // NOTA (fix): "world.beforeEvents.entitySpawn" NO EXISTE en la Script API
  // estable (solo hay evento "after" para el spawn de entidades). Intentar
  // suscribirse a él lanzaba un TypeError inmediato aquí mismo, y como
  // startVoidSystem() se llama ANTES que startControlSystem() en main.js,
  // ese error cortaba en seco el resto del arranque: el "Control de los
  // Mundos" (objeto y /scriptevent) nunca llegaba a registrarse. Por eso
  // no funcionaba ni el control ni los comandos. Nos quedamos solo con la
  // limpieza reactiva (after), que cubre el mismo propósito de forma segura.

  // Limpieza reactiva (fallback universal): elimina lo que no debió aparecer.
  world.afterEvents.entitySpawn.subscribe((event) => {
    const entity = event.entity;
    if (entity.typeId === "minecraft:player") return;
    const level = getLevelById(entity.dimension.id);
    if (level && !level.inhabited) {
      entity.remove();
    }
  });
}

/**
 * Puebla un nivel habitado con mobs de terror repartidos por la zona.
 */
export function spawnMobsForLevel(level, dim, spawn) {
  const count = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const type = Math.random() < 0.6 ? "dreamcore:tall_shadow" : "dreamcore:faceless";
    // Buscar un punto despejado (2 bloques de aire) para no meter al mob en un muro.
    let placed = false;
    for (let attempt = 0; attempt < 10 && !placed; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 14;
      const x = Math.floor(spawn.x + Math.cos(angle) * dist);
      const z = Math.floor(spawn.z + Math.sin(angle) * dist);
      const y = spawn.y - 1; // justo sobre el suelo

      const feet = dim.getBlock({ x, y, z });
      const head = dim.getBlock({ x, y: y + 1, z });
      if (
        feet && head &&
        feet.typeId === "minecraft:air" &&
        head.typeId === "minecraft:air"
      ) {
        dim.spawnEntity(type, { x, y, z });
        placed = true;
      }
    }
  }
}

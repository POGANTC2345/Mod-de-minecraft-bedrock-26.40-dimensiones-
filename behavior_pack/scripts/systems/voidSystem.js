/**
 * voidSystem.js — Control de población y entidades en las dimensiones.
 *
 * Se eliminó cualquier restricción de eliminación automática de entidades para que
 * ningún mob, entidad personalizada o mod desaparezca al ser colocado o spawneado
 * en ninguna dimensión.
 */
import { world } from "@minecraft/server";
import { getLevelById } from "../levels/levelRegistry.js";

export function startVoidSystem() {
  // Sin restricciones de eliminación de entidades: las entidades y mods
  // permanecen siempre donde los coloques o spawnees.
}

/**
 * Puebla un nivel habitado con mobs de terror repartidos por la zona.
 */
export function spawnMobsForLevel(level, dim, spawn) {
  const count = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const type = Math.random() < 0.6 ? "dreamcore:tall_shadow" : "dreamcore:faceless";
    let placed = false;
    for (let attempt = 0; attempt < 10 && !placed; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 14;
      const x = Math.floor(spawn.x + Math.cos(angle) * dist);
      const z = Math.floor(spawn.z + Math.sin(angle) * dist);
      const y = spawn.y - 1;

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

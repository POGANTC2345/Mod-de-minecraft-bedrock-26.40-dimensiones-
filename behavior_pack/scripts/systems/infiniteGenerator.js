/**
 * infiniteGenerator.js — Tick de generación infinita.
 *
 * NO usa "fake players" ni ticking areas permanentes. Se apoya en la distancia
 * de simulación del propio jugador: los chunks cercanos a él ya están cargados,
 * por lo que podemos colocar bloques directamente en ellos.
 *
 * Cada tick, por cada jugador dentro de un nivel "infinito", genera las celdas
 * (celdas = habitaciones/pasillos de ~12×12) que aún no existen dentro de un
 * radio. La generación es DETERMINISTA (hash de las coordenadas), así que es
 * consistente aunque el jugador vuelva a la misma zona.
 */
import { system, world } from "@minecraft/server";
import { INFINITE } from "../config.js";
import { getDreamState } from "./dreamTimer.js";
import { getLevelById } from "../levels/levelRegistry.js";
import { generateAround } from "./levelBuilder.js";

export function startInfiniteGenerator() {
  system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
      const st = getDreamState(player);
      if (!st) continue;

      const level = getLevelById(st.levelId);
      // Todos los niveles son infinitos ahora; la propiedad está en el nivel, no en el tema.
      if (!level || !level.infinite) continue;

      generateAround(
        level,
        player.dimension,
        player.location.x,
        player.location.z,
        INFINITE.maxGenPerTick
      );
    }
  }, INFINITE.tickInterval);
}

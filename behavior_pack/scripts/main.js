/**
 * main.js — Punto de entrada del add-on.
 *
 * 1. Registra las dimensiones personalizadas durante el `startup`.
 * 2. Al cargar el mundo, arranca todos los sistemas.
 * 3. Entrega el "Control de los Mundos" a cada jugador al aparecer.
 */
import { system, world, ItemStack } from "@minecraft/server";
import { LEVELS } from "./levels/levelRegistry.js";
import { registerAllDimensions } from "./systems/levelBuilder.js";
import { startPortalSystem } from "./systems/portalSystem.js";
import { startDreamTimer } from "./systems/dreamTimer.js";
import { startVoidSystem } from "./systems/voidSystem.js";
import { startReturnPortalSystem } from "./systems/returnPortalSystem.js";
import { startAmbienceSystem } from "./systems/ambienceSystem.js";
import { startDistortionSystem } from "./systems/distortionSystem.js";
import { startInfiniteGenerator } from "./systems/infiniteGenerator.js";
import { startControlSystem } from "./systems/controlSystem.js";

// 1) Registrar dimensiones en la fase de startup (requisito de la API).
system.beforeEvents.startup.subscribe((event) => {
  registerAllDimensions(event, LEVELS);
});

// 2) Al cargar el mundo, arrancar los sistemas.
// FIX: cada sistema se arranca en su propio try/catch. Antes, si UN solo
// sistema lanzaba un error al arrancar (p. ej. voidSystem con una API que
// no existía), el resto de la lista NUNCA llegaba a ejecutarse — incluido
// startControlSystem(), que es justo el que registra el objeto "Control de
// los Mundos" y los comandos /scriptevent. Con try/catch, un fallo en un
// sistema queda aislado y no apaga a los demás.
const SYSTEMS = [
  ["portalSystem", startPortalSystem],
  ["dreamTimer", startDreamTimer],
  ["voidSystem", startVoidSystem],
  ["returnPortalSystem", startReturnPortalSystem],
  ["ambienceSystem", startAmbienceSystem],
  ["distortionSystem", startDistortionSystem],
  ["infiniteGenerator", startInfiniteGenerator],
  ["controlSystem", startControlSystem],
];

world.afterEvents.worldLoad.subscribe(() => {
  let ok = 0;
  for (const [name, start] of SYSTEMS) {
    try {
      start();
      ok++;
    } catch (e) {
      console.error(`[Dreamcore] El sistema "${name}" falló al iniciar y fue omitido:`, e);
    }
  }

  console.warn(`[Dreamcore] Sistemas iniciados: ${ok}/${SYSTEMS.length}. Niveles registrados:`, LEVELS.length);
});

// 3) Entregar el Control de los Mundos + aviso de versión al aparecer.
const VERSION_TAG = "Dreamcore v3 · Control de los Mundos activo";

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return; // solo la primera vez (no al revivir)

  system.runTimeout(() => {
    try {
      player.onScreenDisplay.setTitle(VERSION_TAG, {
        subtitle: "Tienes un 'Control de los Mundos'. Úsalo para entrar a cualquier nivel.",
        fadeInDuration: 10,
        stayDuration: 70,
        fadeOutDuration: 20,
      });
    } catch (_) { /* noop */ }

    giveRemote(player);
  }, 20);
});

function giveRemote(player) {
  try {
    const inv = player.getComponent("minecraft:inventory");
    const container = inv?.container;
    if (!container) return;

    // Evitar duplicados.
    for (let i = 0; i < container.size; i++) {
      const it = container.getItem(i);
      if (it?.typeId === "dreamcore:dream_remote") return;
    }
    container.addItem(new ItemStack("dreamcore:dream_remote", 1));
  } catch (_) { /* noop */ }
}

/**
 * controlSystem.js — "Control de los Mundos" (objeto para entrar sin portal).
 *
 * Da al jugador un objeto (dreamcore:dream_remote) que abre un menú
 * con acceso a los 22 niveles del mod. Comandos scriptevent incluidos.
 */
import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { LEVELS, getLevelById } from "../levels/levelRegistry.js";
import { enterLevel, exitLevel, getDreamState } from "./dreamTimer.js";
import { forceSpawnPortal } from "./portalSystem.js";

const ITEM_ID = "dreamcore:dream_remote";
let seqPointer = 0;

export function startControlSystem() {
  world.afterEvents.itemUse.subscribe((event) => {
    if (event.itemStack?.typeId !== ITEM_ID) return;
    openMenu(event.source);
  });

  world.afterEvents.scriptEventReceive.subscribe((event) => {
    const p = event.sourceEntity;
    if (!p || p.typeId !== "minecraft:player") return;
    switch (event.id) {
      case "dreamcore:menu": openMenu(p); break;
      case "dreamcore:enter": enterRandom(p); break;
      case "dreamcore:exit": exitLevel(p, false); break;
      case "dreamcore:portal": forceSpawnPortal(p); break;
      case "dreamcore:spawn": {
        try {
          p.dimension.spawnEntity("dreamcore:tall_shadow", p.location);
          p.sendMessage("§a[Dreamcore] Entidad invocada con éxito.");
        } catch (e) {
          p.sendMessage("§c[Dreamcore] Error al invocar entidad: " + e);
        }
        break;
      }
    }
  });
}

function openMenu(player) {
  const form = new ActionFormData();
  form.title("§bControl de los Mundos (22 Niveles)");
  form.body("Elige tu destino liminal o de ensueño. Usa el control en cualquier momento.");

  form.button("🌌 Nivel aleatorio");
  form.button("⏭️ Siguiente nivel");
  form.button("🚪 Despertar (volver al Overworld)");
  form.button("✨ Forzar portal de regreso cerca");
  form.button("👾 Invocar entidad de prueba");

  for (const l of LEVELS) {
    form.button((l.inhabited ? "§c" : "§8") + l.name);
  }

  form.show(player).then((res) => {
    if (res.canceled || res.selection === undefined) return;
    const i = res.selection;

    if (i === 0) enterRandom(player);
    else if (i === 1) enterSequential(player);
    else if (i === 2) exitLevel(player, false);
    else if (i === 3) forceSpawnPortal(player);
    else if (i === 4) {
      try {
        player.dimension.spawnEntity("dreamcore:tall_shadow", player.location);
        player.sendMessage("§a[Dreamcore] Entidad invocada.");
      } catch (e) {
        player.sendMessage("§c[Dreamcore] Error: " + e);
      }
    } else {
      const level = LEVELS[i - 5];
      if (level) enterLevel(player, level.id, safeReturnPoint(player));
    }
  }).catch((e) => console.warn("[Dreamcore] UI error:", e));
}

function safeReturnPoint(player) {
  const st = getDreamState(player);
  if (st && st.returnLoc) return st.returnLoc;
  const loc = player.location;
  return { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) };
}

function enterRandom(player) {
  const id = LEVELS[Math.floor(Math.random() * LEVELS.length)].id;
  enterLevel(player, id, safeReturnPoint(player));
}

function enterSequential(player) {
  const id = LEVELS[seqPointer++ % LEVELS.length].id;
  enterLevel(player, id, safeReturnPoint(player));
}

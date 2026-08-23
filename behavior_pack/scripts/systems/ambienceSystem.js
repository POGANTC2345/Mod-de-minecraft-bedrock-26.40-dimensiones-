/**
 * ambienceSystem.js — Audio ambiente por nivel + parpadeo de luces + partículas.
 *
 * El Dreamcore depende ~80% del sonido. Aquí:
 *   · Cada nivel reproduce un bucle de música ambiente (zumbido, caja de música...).
 *   · Los niveles con "flicker" hacen parpadear sus luces fluorescentes.
 *   · Ocasionalmente se oyen pasos lejanos (la paranoia de no estar solo).
 *   · Cada nivel tiene su PROPIA partícula ambiente (theme.particle en
 *     levelRegistry.js): polvo, burbujas, luciérnagas, ceniza, niebla...
 *     Reutiliza "minecraft:colored_flame_particle" con distinto color/patrón
 *     de movimiento por tema — es la misma partícula ya probada y segura que
 *     usa portalSystem.js, así que no repite el bug del ID inválido anterior.
 */
import { system, world, MolangVariableMap } from "@minecraft/server";
import { getDreamState } from "./dreamTimer.js";
import { getLevelById } from "../levels/levelRegistry.js";
import { getBuiltLevel } from "./levelBuilder.js";

const musicByPlayer = new Map(); // playerId -> trackId en curso
const lastFootstepAt = new Map(); // playerId -> ms

const RAINBOW = [
  { red: 1, green: 0.3, blue: 0.3 }, { red: 1, green: 0.85, blue: 0.2 },
  { red: 0.3, green: 1, blue: 0.4 }, { red: 0.3, green: 0.7, blue: 1 },
  { red: 0.9, green: 0.3, blue: 1 },
];

export function startAmbienceSystem() {
  system.runInterval(tick, 20);       // música / parpadeo / pasos: cada 1 s
  system.runInterval(particleTick, 6); // partículas ambiente: más fluido
}

function particleTick() {
  for (const player of world.getAllPlayers()) {
    const st = getDreamState(player);
    if (!st) continue;
    const level = getLevelById(st.levelId);
    if (!level || !level.theme.particle) continue;
    spawnAmbientParticles(player, level.theme.particle);
  }
}

function spawnAmbientParticles(player, particle) {
  try {
    const dim = player.dimension;
    const loc = player.location;
    const n = particle.density ?? 1;
    for (let i = 0; i < n; i++) {
      const map = new MolangVariableMap();
      const color = particle.style === "rainbow" ? RAINBOW[Math.floor(Math.random() * RAINBOW.length)] : particle.color;
      map.setColorRGB("variable.color", color);

      const angle = Math.random() * Math.PI * 2;
      const dist = 2 + Math.random() * 6;
      const x = loc.x + Math.cos(angle) * dist;
      const z = loc.z + Math.sin(angle) * dist;

      let y;
      if (particle.style === "rise" || particle.style === "rainbow") y = loc.y + Math.random() * 1.5;
      else if (particle.style === "fall") y = loc.y + 2 + Math.random() * 2.5;
      else if (particle.style === "swirl") y = loc.y + 0.5 + Math.sin(Date.now() / 300 + i) * 1.2;
      else y = loc.y + Math.random() * 2.5; // "drift"

      dim.spawnParticle("minecraft:colored_flame_particle", { x, y, z }, map);
    }
  } catch (_) {
    // Puramente estético: un fallo aquí nunca debe afectar nada más del juego.
  }
}

function tick() {
  const now = Date.now();

  for (const player of world.getAllPlayers()) {
    const st = getDreamState(player);

    // Fuera de un nivel: silencio.
    if (!st) {
      if (musicByPlayer.has(player.id)) {
        player.stopMusic();
        musicByPlayer.delete(player.id);
      }
      continue;
    }

    const level = getLevelById(st.levelId);
    if (!level) continue;

    // 1) Bucle de música ambiente.
    const track = level.theme.ambience.replace(":", ".");
    const current = musicByPlayer.get(player.id);
    if (current !== track) {
      if (level.theme.ambience === "dreamcore:silence") {
        player.stopMusic(); // silencio absoluto y ensordecedor
      } else {
        player.playMusic(track, { loop: true, volume: 0.35 });
      }
      musicByPlayer.set(player.id, track);
    }

    // 2) Parpadeo de luces fluorescentes.
    if (level.theme.flicker) {
      flickerLights(player.dimension, level);
    }

    // 3) Pasos lejanos ocasionales (incluso en niveles vacíos).
    const last = lastFootstepAt.get(player.id) ?? 0;
    if (now - last > 15000 + Math.random() * 15000) {
      player.playSound("dreamcore:footsteps_distant", {
        volume: 0.5,
        pitch: 0.8 + Math.random() * 0.4,
      });
      lastFootstepAt.set(player.id, now);
    }
  }
}

function flickerLights(dim, level) {
  const built = getBuiltLevel(level.id);
  if (!built) return;

  const lights = built.fixtures.lights;
  if (!lights.length) return;

  // Apagar/encender un puñado de luces al azar.
  const n = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const l = lights[Math.floor(Math.random() * lights.length)];
    if (l.dim) continue; // las luces tenues (soul_lantern) no parpadean
    const block = dim.getBlock({ x: l.x, y: l.y, z: l.z });
    if (!block) continue;
    const isLit = block.typeId !== "minecraft:black_concrete";
    block.setType(isLit ? "minecraft:black_concrete" : (l.lit ?? "minecraft:glowstone"));
  }
}

/**
 * distortionSystem.js — Distorsión progresiva por tiempo + daño por vacío.
 *
 * No hay expulsión. El mundo "se rompe" cuanto más tiempo permaneces,
 * presionando al jugador a encontrar el portal de regreso. Pasados 20 min,
 * empieza a aplicar daño continuo (el vacío te "come" si te quedas demasiado).
 */
import { system, world } from "@minecraft/server";
import { DISTORTION } from "../config.js";
import { getDreamState } from "./dreamTimer.js";

const lastSoundAt  = new Map();
const lastDamageAt = new Map();

export function startDistortionSystem() {
  system.runInterval(tick, 10); // cada 0.5 s
}

function tick() {
  const now = Date.now();

  for (const player of world.getAllPlayers()) {
    const st = getDreamState(player);
    if (!st) continue;

    const elapsedSec = (Date.now() - st.enteredAt) / 1000;

    // Sin distorsión en los primeros 5 min → exploración tranquila
    if (!st.distorting) continue;

    const p = st.progress; // 0..1 dentro de la ventana de distorsión

    // ── 1) Náusea progresiva ────────────────────────────────────────────────
    const amp = p < 0.4 ? 0 : p < 0.7 ? 1 : 2;
    try { player.addEffect("minecraft:nausea", 30, { amplifier: amp, showParticles: false }); } catch (_) {}

    // ── 2) Ceguera intermitente (fase media)
    if (p >= 0.4 && p < 0.7 && Math.random() < 0.25) {
      try { player.addEffect("minecraft:blindness", 15, { showParticles: false }); } catch (_) {}
    }

    // ── 3) Fase final: oscuridad + lentitud constante
    if (p >= 0.7) {
      try { player.addEffect("minecraft:blindness",  30, { showParticles: false }); } catch (_) {}
      try { player.addEffect("minecraft:darkness",   30, { showParticles: false }); } catch (_) {}
      try { player.addEffect("minecraft:slowness",   20, { amplifier: 1, showParticles: false }); } catch (_) {}
    }

    // ── 4) Sonidos fuertes aleatorios
    const lastSnd = lastSoundAt.get(player.id) ?? 0;
    if (now - lastSnd > 2000 + Math.random() * 3000) {
      const snd = DISTORTION.sounds[Math.floor(Math.random() * DISTORTION.sounds.length)];
      try { player.playSound(snd, { volume: 1, pitch: 0.7 + Math.random() * 0.6 }); } catch (_) {}
      lastSoundAt.set(player.id, now);
    }

    // ── 5) Destello de cámara en fase final
    if (p >= 0.7 && Math.random() < 0.04) {
      try {
        player.camera.fade({
          fadeColor: { red: 1, green: 0, blue: 0 },
          fadeTime: { fadeInTime: 0.05, holdTime: 0.05, fadeOutTime: 0.3 },
        });
      } catch (_) {}
    }

    // ── 6) Daño por vacío (20+ min, cada 30 s) ────────────────────────────
    if (elapsedSec >= DISTORTION.damageSec) {
      const lastDmg = lastDamageAt.get(player.id) ?? 0;
      if (now - lastDmg > DISTORTION.damageIntervalSec * 1000) {
        try {
          player.applyDamage(2); // 1 corazón
          player.sendMessage("§4El vacío te consume...");
        } catch (_) {}
        lastDamageAt.set(player.id, now);
      }
    }
  }
}

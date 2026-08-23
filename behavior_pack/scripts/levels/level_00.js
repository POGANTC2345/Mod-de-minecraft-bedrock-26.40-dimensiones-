/**
 * level_00.js — Nivel 0 "Las Oficinas" (Backrooms), construido a mano.
 *
 * Este archivo demuestra cómo personalizar un nivel concreto más allá del
 * generador genérico: un pasillo amarillo infinito con alcobas laterales,
 * moqueta húmeda, papel tapiz desgastado y luces fluorescentes que parpadean.
 *
 * Se enlaza en levelBuilder.js: si el nivel es el índice 0, se usa este builder.
 */

import { BlockVolume } from "@minecraft/server";

// Helpers locales (autocontenidos para que sea fácil de leer/modificar).
// FIX: mismo problema que en levelBuilder.js — fillBlocks ahora exige un
// BlockVolume, no dos esquinas sueltas. Ver el comentario allí para más detalle.
function box(dim, x1, y1, z1, x2, y2, z2, block) {
  const from = { x: Math.min(x1, x2), y: Math.min(y1, y2), z: Math.min(z1, z2) };
  const to = { x: Math.max(x1, x2), y: Math.max(y1, y2), z: Math.max(z1, z2) };
  dim.fillBlocks(new BlockVolume(from, to), block);
}
function set(dim, x, y, z, block) {
  dim.getBlock({ x, y, z }).setType(block);
}

export function buildLevel00(dim, level, center, radius, fixtures) {
  const p = level.theme.palette;
  const H = 4;                  // altura de muros
  const yF = center.y;          // nivel del suelo
  const yC = center.y + H;      // nivel del techo
  const halfW = 2;              // medio ancho del pasillo (pasillo de 4 de ancho)
  const len = radius;           // medio largo del pasillo

  // 1) Suelo y techo del pasillo principal (a lo largo del eje Z).
  box(dim, center.x - halfW, yF, center.z - len, center.x + halfW, yF, center.z + len, p.floor);
  box(dim, center.x - halfW, yC, center.z - len, center.x + halfW, yC, center.z + len, p.ceiling);

  // 2) Paredes laterales.
  box(dim, center.x - halfW, yF + 1, center.z - len, center.x - halfW, yC - 1, center.z + len, p.wall);
  box(dim, center.x + halfW, yF + 1, center.z - len, center.x + halfW, yC - 1, center.z + len, p.wall);

  // 3) Muros de cierre en los extremos (sensación de "bucle" al toparte con ellos).
  box(dim, center.x - halfW, yF + 1, center.z - len, center.x + halfW, yC - 1, center.z - len, p.wall);
  box(dim, center.x - halfW, yF + 1, center.z + len, center.x + halfW, yC - 1, center.z + len, p.wall);

  // 4) Luces fluorescentes en el techo, cada 6 bloques.
  for (let z = center.z - len + 3; z <= center.z + len - 3; z += 6) {
    set(dim, center.x, yC - 1, z, p.light);
    fixtures.lights.push({ x: center.x, y: yC - 1, z, lit: p.light });
  }

  // 5) Alcobas laterales (habitaciones vacías) a intervalos regulares.
  let i = 0;
  for (let z = center.z - len + 6; z <= center.z + len - 6; z += 14) {
    const side = i % 2 === 0 ? 1 : -1; // alternar lado
    i++;

    // Hueco de puerta (2 de alto) en la pared del pasillo.
    set(dim, center.x + side * halfW, yF + 1, z, "minecraft:air");
    set(dim, center.x + side * halfW, yF + 2, z, "minecraft:air");

    // Habitación lateral de 4x5.
    const rx1 = center.x + side * (halfW + 1);
    const rx2 = center.x + side * (halfW + 5);
    box(dim, rx1, yF, z - 2, rx2, yF, z + 2, p.floor);
    box(dim, rx1, yC, z - 2, rx2, yC, z + 2, p.ceiling);

    // Paredes de la habitación.
    box(dim, rx1, yF + 1, z - 2, rx2, yC - 1, z - 2, p.wall);
    box(dim, rx1, yF + 1, z + 2, rx2, yC - 1, z + 2, p.wall);
    box(dim, rx2, yF + 1, z - 2, rx2, yC - 1, z + 2, p.wall);

    // Luz en la habitación.
    set(dim, Math.floor((rx1 + rx2) / 2), yC - 1, z, p.light);
    fixtures.lights.push({ x: Math.floor((rx1 + rx2) / 2), y: yC - 1, z, lit: p.light });
  }
}

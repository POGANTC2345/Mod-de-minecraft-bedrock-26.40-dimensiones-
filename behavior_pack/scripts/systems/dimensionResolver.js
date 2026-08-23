/**
 * dimensionResolver.js — Resuelve dónde vive cada nivel (dimensión real o fallback).
 *
 * Si las dimensiones personalizadas funcionan (1.26.30+), cada nivel es su propia
 * dimensión "void". Si por cualquier motivo fallan en la versión del usuario,
 * nos caemos automáticamente a la técnica profesional de "coordenadas lejanas"
 * dentro del Overworld, de modo que SIEMPRE se puede entrar a los mundos.
 *
 * La detección es en caliente: si getDimension() lanza al intentar usar una
 * dimensión custom, se marca el modo fallback y todo lo demás lo usa.
 */
import { world } from "@minecraft/server";

let customDims = true;

export function markCustomDimsUnavailable() {
  customDims = false;
}

export function customDimsEnabled() {
  return customDims;
}

/**
 * Devuelve el "destino" de un nivel:
 * { dim, fallback, floorY, centerX, centerZ }
 */
export function levelTarget(level) {
  if (customDims) {
    try {
      const dim = world.getDimension(level.id);
      if (dim) {
        return { dim, fallback: false, floorY: 64, centerX: 0, centerZ: 0 };
      }
    } catch (_) {
      // La dimensión no existe → activar fallback.
      customDims = false;
    }
  }
  // Fallback: coordenadas lejanas (100k de separación) a gran altura en el Overworld.
  return {
    dim: world.getDimension("minecraft:overworld"),
    fallback: true,
    floorY: 200,
    centerX: 100000 + level.index * 10000,
    centerZ: 50000,
  };
}

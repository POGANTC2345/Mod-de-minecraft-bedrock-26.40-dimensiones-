/**
 * levelRegistry.js — 12 niveles, TODOS infinitos.
 *
 * Cada nivel tiene su tema (paleta, niebla, sonido, partícula) y sus flags:
 *   · openWorld  → sin muros ni techo entre celdas (vecindario, bosque, parque).
 *   · corridorZ  → pasillos abiertos en dirección Z, muros sólidos en X
 *                  (hotel, escuela, mall). El decorador añade la partición interior.
 *   · ceilOffset → altura de techo personalizada.
 *
 * La única salida es el Portal de Regreso (o morir). No hay temporizador
 * de expulsión.
 */

export const NAMESPACE = "dreamcore";

export const THEMES = {
  office: {
    name: "Las Oficinas Amarillas",
    openWorld: false, corridorZ: false,
    palette: {
      wall: `${NAMESPACE}:yellow_wallpaper`, floor: `${NAMESPACE}:wet_carpet`,
      ceiling: `${NAMESPACE}:ceiling_tile`, light: `${NAMESPACE}:fluorescent_light`,
    },
    flicker: true, fog: `${NAMESPACE}:fog_yellow`,
    ambience: `${NAMESPACE}:hum_fluorescent`,
    particle: { color: { red: 1, green: 0.95, blue: 0.7 }, density: 1, style: "drift" },
  },
  neighborhood: {
    name: "El Vecindario",
    openWorld: true, corridorZ: false, ceilOffset: 30,
    palette: {
      wall: "minecraft:air", floor: "minecraft:coarse_dirt",
      ceiling: "minecraft:air", light: "minecraft:air",
    },
    flicker: false, fog: `${NAMESPACE}:fog_gray`,
    ambience: `${NAMESPACE}:silence`,
    particle: { color: { red: 0.75, green: 0.78, blue: 0.82 }, density: 1, style: "drift" },
  },
  pool: {
    name: "Las Piscinas",
    openWorld: false, corridorZ: false, ceilOffset: 5,
    palette: {
      wall: "minecraft:quartz_bricks", floor: "minecraft:white_concrete",
      ceiling: "minecraft:quartz_block", light: "minecraft:sea_lantern",
      water: "minecraft:water",
    },
    flicker: false, fog: `${NAMESPACE}:fog_aqua`,
    ambience: `${NAMESPACE}:hum_pool`,
    particle: { color: { red: 0.6, green: 0.95, blue: 1 }, density: 2, style: "rise" },
  },
  playground: {
    name: "El Parque Nocturno",
    openWorld: true, corridorZ: false, ceilOffset: 30,
    palette: {
      wall: "minecraft:air", floor: "minecraft:gravel",
      ceiling: "minecraft:air", light: "minecraft:air",
    },
    flicker: false, fog: `${NAMESPACE}:fog_night`,
    ambience: `${NAMESPACE}:music_box`,
    particle: { color: { red: 0.4, green: 0.55, blue: 0.9 }, density: 1, style: "fall" },
  },
  maze: {
    name: "Laberinto de Concreto",
    openWorld: false, corridorZ: false, ceilOffset: 5,
    palette: {
      wall: "minecraft:gray_concrete", floor: "minecraft:stone",
      ceiling: "minecraft:gray_concrete", light: "minecraft:glowstone",
    },
    flicker: false, fog: `${NAMESPACE}:fog_gray`,
    ambience: `${NAMESPACE}:hum_low`,
    particle: { color: { red: 0.8, green: 0.8, blue: 0.85 }, density: 1, style: "drift" },
  },
  forest: {
    name: "Bosque sin Cielo",
    openWorld: true, corridorZ: false, ceilOffset: 30,
    palette: {
      wall: "minecraft:air", floor: "minecraft:podzol",
      ceiling: "minecraft:air", light: "minecraft:air",
    },
    flicker: false, fog: `${NAMESPACE}:fog_mist`,
    ambience: `${NAMESPACE}:silence`,
    particle: { color: { red: 0.65, green: 0.9, blue: 0.35 }, density: 2, style: "swirl" },
  },
  hotel: {
    name: "Hotel Carmesí",
    openWorld: false, corridorZ: true, ceilOffset: 5,
    palette: {
      wall: `${NAMESPACE}:faded_wallpaper`, floor: "minecraft:crimson_planks",
      ceiling: `${NAMESPACE}:ceiling_tile`, light: `${NAMESPACE}:fluorescent_light`,
    },
    flicker: true, fog: `${NAMESPACE}:fog_crimson`,
    ambience: `${NAMESPACE}:hum_fluorescent`,
    particle: { color: { red: 1, green: 0.25, blue: 0.25 }, density: 2, style: "rise" },
  },
  school: {
    name: "Escuela Abandonada",
    openWorld: false, corridorZ: true, ceilOffset: 4,
    palette: {
      wall: "minecraft:yellow_terracotta", floor: "minecraft:spruce_planks",
      ceiling: `${NAMESPACE}:ceiling_tile`, light: `${NAMESPACE}:fluorescent_light`,
    },
    flicker: true, fog: `${NAMESPACE}:fog_yellow`,
    ambience: `${NAMESPACE}:hum_fluorescent`,
    particle: { color: { red: 1, green: 1, blue: 0.85 }, density: 1, style: "fall" },
  },
  mall: {
    name: "Centro Comercial Vacío",
    openWorld: false, corridorZ: true, ceilOffset: 6,
    palette: {
      wall: "minecraft:smooth_quartz", floor: "minecraft:light_gray_concrete",
      ceiling: "minecraft:quartz_block", light: "minecraft:glowstone",
    },
    flicker: false, fog: `${NAMESPACE}:fog_pale`,
    ambience: `${NAMESPACE}:music_box`,
    particle: { color: { red: 0.95, green: 0.4, blue: 0.9 }, density: 2, style: "drift" },
  },
  parking: {
    name: "Estacionamiento Subterráneo",
    openWorld: false, corridorZ: false, ceilOffset: 4,
    palette: {
      wall: "minecraft:gray_concrete", floor: "minecraft:light_gray_concrete",
      ceiling: "minecraft:gray_concrete", light: "minecraft:glowstone",
    },
    flicker: true, fog: `${NAMESPACE}:fog_gray`,
    ambience: `${NAMESPACE}:hum_low`,
    particle: { color: { red: 1, green: 0.55, blue: 0.15 }, density: 1, style: "drift" },
  },
  toy: {
    name: "Ciudad de Juguete",
    openWorld: false, corridorZ: false, ceilOffset: 6,
    palette: {
      wall: "minecraft:white_concrete", floor: "minecraft:light_gray_concrete",
      ceiling: "minecraft:white_wool", light: "minecraft:glowstone",
    },
    flicker: true, fog: `${NAMESPACE}:fog_pale`,
    ambience: `${NAMESPACE}:hum_fluorescent`,
    particle: { color: { red: 1, green: 1, blue: 1 }, density: 2, style: "rainbow" },
  },
  sewers: {
    name: "Las Alcantarillas",
    openWorld: false, corridorZ: false, ceilOffset: 3,
    palette: {
      wall: "minecraft:mossy_stone_bricks", floor: "minecraft:mud",
      ceiling: "minecraft:stone_bricks", light: "minecraft:sea_lantern",
      water: "minecraft:water",
    },
    flicker: false, fog: `${NAMESPACE}:fog_mist`,
    ambience: `${NAMESPACE}:hum_low`,
    particle: { color: { red: 0.55, green: 0.75, blue: 0.35 }, density: 2, style: "rise" },
  },
};

// Todos los niveles son infinitos. El jugador escapa por el Portal de Regreso o muriendo.
// inhabited=false → sin mobs (solo sonido y paranoia).
const LEVEL_DEFS = [
  ["office",       "Nivel 0 — Las Oficinas",               false],
  ["neighborhood", "Nivel 1 — El Vecindario",              true ],
  ["pool",         "Nivel 2 — Las Piscinas",               true ],
  ["playground",   "Nivel 3 — El Parque Nocturno",         false],
  ["maze",         "Nivel 4 — Laberinto de Concreto",      false],
  ["forest",       "Nivel 5 — Bosque sin Cielo",           false],
  ["hotel",        "Nivel 6 — Hotel Carmesí",              true ],
  ["school",       "Nivel 7 — Escuela Abandonada",         false],
  ["mall",         "Nivel 8 — Centro Comercial Vacío",     true ],
  ["parking",      "Nivel 9 — Estacionamiento Subterráneo",true ],
  ["toy",          "Nivel 10 — Ciudad de Juguete",         true ],
  ["sewers",       "Nivel 11 — Las Alcantarillas",         true ],
];

export const LEVELS = LEVEL_DEFS.map(([themeKey, name, inhabited], i) => ({
  id:        `${NAMESPACE}:level_${String(i).padStart(2, "0")}`,
  index:     i,
  name,
  themeKey,
  theme:     THEMES[themeKey],
  inhabited,
  infinite:  true,
}));

export function getLevelById(id)          { return LEVELS.find(l => l.id === id) ?? null; }
export function getRandomLevelId(rng = Math.random) {
  return LEVELS[Math.floor(rng() * LEVELS.length)].id;
}
export function getSequentialLevelId(ptr) { return LEVELS[ptr % LEVELS.length].id; }

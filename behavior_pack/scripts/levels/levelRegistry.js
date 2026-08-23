/**
 * levelRegistry.js — 22 niveles únicos con estéticas Dreamcore y Liminal Spaces.
 *
 * Cada nivel tiene su propia paleta, niebla, música, partículas y diseño procedural.
 * Absolutamente todos los bloques de suelo y estructura son sólidos y estables
 * (sin grava ni bloques con gravedad para evitar colapsos).
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
    name: "El Vecindario Infinito",
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
    name: "Las Piscinas Liminales",
    openWorld: false, corridorZ: false, ceilOffset: 6,
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
      wall: "minecraft:air", floor: "minecraft:smooth_stone",
      ceiling: "minecraft:air", light: "minecraft:air",
    },
    flicker: false, fog: `${NAMESPACE}:fog_night`,
    ambience: `${NAMESPACE}:music_box`,
    particle: { color: { red: 0.4, green: 0.55, blue: 0.9 }, density: 1, style: "fall" },
  },
  maze: {
    name: "Laberinto de Concreto Brutalista",
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
  // Nuevos mundos únicos (12 a 21)
  flower_field: {
    name: "Campo de Flores Infinito",
    openWorld: true, corridorZ: false, ceilOffset: 30,
    palette: {
      wall: "minecraft:air", floor: "minecraft:grass_block",
      ceiling: "minecraft:air", light: "minecraft:air",
    },
    flicker: false, fog: `${NAMESPACE}:fog_yellow`,
    ambience: `${NAMESPACE}:music_box`,
    particle: { color: { red: 1, green: 0.8, blue: 0.9 }, density: 2, style: "drift" },
  },
  living_room: {
    name: "Salas de Estar Nostálgicas",
    openWorld: false, corridorZ: false, ceilOffset: 4,
    palette: {
      wall: "minecraft:brown_terracotta", floor: "minecraft:brown_wool",
      ceiling: "minecraft:oak_planks", light: "minecraft:glowstone",
    },
    flicker: true, fog: `${NAMESPACE}:fog_pale`,
    ambience: `${NAMESPACE}:hum_low`,
    particle: { color: { red: 0.9, green: 0.7, blue: 0.5 }, density: 1, style: "fall" },
  },
  arcade: {
    name: "Salón de Arcade Vacío",
    openWorld: false, corridorZ: true, ceilOffset: 5,
    palette: {
      wall: "minecraft:black_concrete", floor: "minecraft:magenta_wool",
      ceiling: "minecraft:smooth_quartz", light: "minecraft:sea_lantern",
    },
    flicker: true, fog: `${NAMESPACE}:fog_night`,
    ambience: `${NAMESPACE}:music_box`,
    particle: { color: { red: 1, green: 0.2, blue: 0.8 }, density: 2, style: "rainbow" },
  },
  train_station: {
    name: "Estación de Tren Silenciosa",
    openWorld: false, corridorZ: true, ceilOffset: 6,
    palette: {
      wall: "minecraft:bricks", floor: "minecraft:smooth_stone",
      ceiling: "minecraft:iron_block", light: "minecraft:glowstone",
      water: "minecraft:water",
    },
    flicker: false, fog: `${NAMESPACE}:fog_mist`,
    ambience: `${NAMESPACE}:hum_fluorescent`,
    particle: { color: { red: 0.7, green: 0.7, blue: 0.75 }, density: 1, style: "drift" },
  },
  art_gallery: {
    name: "Galería de Arte Blanca",
    openWorld: false, corridorZ: false, ceilOffset: 7,
    palette: {
      wall: "minecraft:white_concrete", floor: "minecraft:smooth_quartz",
      ceiling: "minecraft:white_concrete", light: "minecraft:sea_lantern",
    },
    flicker: false, fog: `${NAMESPACE}:fog_pale`,
    ambience: `${NAMESPACE}:silence`,
    particle: { color: { red: 1, green: 1, blue: 1 }, density: 1, style: "drift" },
  },
  porches: {
    name: "Porches y Casas Idénticas",
    openWorld: true, corridorZ: false, ceilOffset: 30,
    palette: {
      wall: "minecraft:air", floor: "minecraft:coarse_dirt",
      ceiling: "minecraft:air", light: "minecraft:air",
    },
    flicker: false, fog: `${NAMESPACE}:fog_gray`,
    ambience: `${NAMESPACE}:silence`,
    particle: { color: { red: 0.8, green: 0.8, blue: 0.8 }, density: 1, style: "drift" },
  },
  desert: {
    name: "Desierto al Atardecer Onírico",
    openWorld: true, corridorZ: false, ceilOffset: 30,
    palette: {
      wall: "minecraft:air", floor: "minecraft:smooth_sandstone",
      ceiling: "minecraft:air", light: "minecraft:air",
    },
    flicker: false, fog: `${NAMESPACE}:fog_crimson`,
    ambience: `${NAMESPACE}:hum_low`,
    particle: { color: { red: 1, green: 0.6, blue: 0.2 }, density: 2, style: "drift" },
  },
  metro: {
    name: "Túneles de Metro Abandonados",
    openWorld: false, corridorZ: true, ceilOffset: 4,
    palette: {
      wall: "minecraft:stone_bricks", floor: "minecraft:stone",
      ceiling: "minecraft:cobblestone", light: "minecraft:glowstone",
    },
    flicker: true, fog: `${NAMESPACE}:fog_gray`,
    ambience: `${NAMESPACE}:hum_low`,
    particle: { color: { red: 0.5, green: 0.5, blue: 0.5 }, density: 1, style: "fall" },
  },
  museum: {
    name: "Museo de Relojería Suspendido",
    openWorld: false, corridorZ: false, ceilOffset: 8,
    palette: {
      wall: "minecraft:polished_andesite", floor: "minecraft:polished_blackstone",
      ceiling: "minecraft:gold_block", light: "minecraft:sea_lantern",
    },
    flicker: false, fog: `${NAMESPACE}:fog_pale`,
    ambience: `${NAMESPACE}:music_box`,
    particle: { color: { red: 1, green: 0.85, blue: 0.4 }, density: 2, style: "rise" },
  },
  glass_labyrinth: {
    name: "Laberinto de Cristal y Espejos",
    openWorld: false, corridorZ: false, ceilOffset: 6,
    palette: {
      wall: "minecraft:glass", floor: "minecraft:light_gray_stained_glass",
      ceiling: "minecraft:glass", light: "minecraft:sea_lantern",
    },
    flicker: false, fog: `${NAMESPACE}:fog_aqua`,
    ambience: `${NAMESPACE}:silence`,
    particle: { color: { red: 0.7, green: 0.9, blue: 1 }, density: 2, style: "swirl" },
  },
};

const LEVEL_DEFS = [
  ["office",         "Nivel 0 — Las Oficinas Amarillas",       false],
  ["neighborhood",   "Nivel 1 — El Vecindario Infinito",       true ],
  ["pool",           "Nivel 2 — Las Piscinas Liminales",       true ],
  ["playground",     "Nivel 3 — El Parque Nocturno",           false],
  ["maze",           "Nivel 4 — Laberinto de Concreto",        false],
  ["forest",         "Nivel 5 — Bosque sin Cielo",             false],
  ["hotel",          "Nivel 6 — Hotel Carmesí",                true ],
  ["school",         "Nivel 7 — Escuela Abandonada",           false],
  ["mall",           "Nivel 8 — Centro Comercial Vacío",       true ],
  ["parking",        "Nivel 9 — Estacionamiento Subterráneo",  true ],
  ["toy",            "Nivel 10 — Ciudad de Juguete",           true ],
  ["sewers",         "Nivel 11 — Las Alcantarillas",           true ],
  ["flower_field",   "Nivel 12 — Campo de Flores Infinito",    true ],
  ["living_room",    "Nivel 13 — Salas de Estar Nostálgicas",  false],
  ["arcade",         "Nivel 14 — Salón de Arcade Vacío",       true ],
  ["train_station",  "Nivel 15 — Estación de Tren Silenciosa", false],
  ["art_gallery",    "Nivel 16 — Galería de Arte Blanca",      false],
  ["porches",        "Nivel 17 — Porches y Casas Idénticas",   true ],
  ["desert",         "Nivel 18 — Desierto al Atardecer Onírico",false],
  ["metro",          "Nivel 19 — Túneles de Metro Abandonados",true ],
  ["museum",         "Nivel 20 — Museo de Relojería",          false],
  ["glass_labyrinth","Nivel 21 — Laberinto de Cristal",        true ],
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

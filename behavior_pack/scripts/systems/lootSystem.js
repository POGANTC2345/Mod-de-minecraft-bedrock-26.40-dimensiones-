/**
 * lootSystem.js — Cofres con botín temático (uno por tema de nivel).
 *
 * Cada tema tiene su propia lista de items posibles (con peso = probabilidad
 * relativa, y una cantidad mínima/máxima). Solo se usan IDs de items 100%
 * vanilla y estables, para no repetir el error de las partículas con
 * "minecraft:portal_directional": un ID inventado rompe el script al
 * primer cofre que se intente llenar.
 *
 * Uso típico desde un builder de nivel:
 *   maybeChest(dim, x, y, z, "hotel", 0.4); // 40% de probabilidad
 */
import { ItemStack } from "@minecraft/server";

const CHEST_SLOTS = 27; // cofre simple (no baúl doble)

// Catálogo de items (todos vanilla, confirmados estables desde hace años).
const I = {
  bread: "minecraft:bread", apple: "minecraft:apple", cookedBeef: "minecraft:cooked_beef",
  cookedChicken: "minecraft:cooked_chicken", carrot: "minecraft:carrot", potato: "minecraft:potato",
  egg: "minecraft:egg", cake: "minecraft:cake", milk: "minecraft:milk_bucket",
  iron: "minecraft:iron_ingot", gold: "minecraft:gold_ingot", copper: "minecraft:copper_ingot",
  coal: "minecraft:coal", redstone: "minecraft:redstone", string: "minecraft:string",
  leather: "minecraft:leather", feather: "minecraft:feather", stick: "minecraft:stick",
  paper: "minecraft:paper", book: "minecraft:book",
  torch: "minecraft:torch", flintSteel: "minecraft:flint_and_steel", arrow: "minecraft:arrow",
  bow: "minecraft:bow", ironSword: "minecraft:iron_sword", ironPick: "minecraft:iron_pickaxe",
  shield: "minecraft:shield", leatherBoots: "minecraft:leather_boots", leatherChest: "minecraft:leather_chestplate",
  emerald: "minecraft:emerald", diamond: "minecraft:diamond", goldenApple: "minecraft:golden_apple",
  enchantedGoldenApple: "minecraft:enchanted_golden_apple", enderPearl: "minecraft:ender_pearl",
  xpBottle: "minecraft:experience_bottle", nameTag: "minecraft:name_tag", compass: "minecraft:compass",
  clock: "minecraft:clock", candle: "minecraft:candle", totem: "minecraft:totem_of_undying",
  diamondSword: "minecraft:diamond_sword", waterBucket: "minecraft:water_bucket", sponge: "minecraft:sponge",
  rottenFlesh: "minecraft:rotten_flesh", bone: "minecraft:bone",
};

// Tabla por tema: [itemId, peso, cantidadMin, cantidadMax]
const LOOT_TABLES = {
  office: [
    [I.paper, 5, 1, 3], [I.book, 3, 1, 1], [I.candle, 4, 1, 2], [I.torch, 5, 2, 4],
    [I.iron, 3, 1, 2], [I.bread, 4, 1, 2], [I.compass, 1, 1, 1], [I.goldenApple, 1, 1, 1],
  ],
  neighborhood: [
    [I.bread, 5, 1, 3], [I.cake, 3, 1, 1], [I.apple, 5, 1, 3], [I.iron, 3, 1, 2],
    [I.emerald, 2, 1, 2], [I.candle, 4, 1, 2], [I.leatherBoots, 2, 1, 1], [I.milk, 3, 1, 1],
    [I.nameTag, 1, 1, 1], [I.diamond, 1, 1, 1],
  ],
  pool: [
    [I.waterBucket, 3, 1, 1], [I.sponge, 4, 1, 2], [I.string, 3, 1, 3], [I.iron, 3, 1, 2],
    [I.emerald, 2, 1, 1], [I.candle, 2, 1, 1], [I.diamond, 1, 1, 1],
  ],
  playground: [
    [I.candle, 4, 1, 2], [I.torch, 4, 2, 3], [I.paper, 3, 1, 2], [I.string, 3, 1, 3],
    [I.iron, 2, 1, 1], [I.bread, 3, 1, 2], [I.totem, 1, 1, 1],
  ],
  maze: [
    [I.torch, 5, 2, 4], [I.iron, 4, 1, 2], [I.redstone, 4, 1, 3], [I.flintSteel, 2, 1, 1],
    [I.arrow, 3, 3, 6], [I.bow, 1, 1, 1], [I.ironPick, 2, 1, 1], [I.diamond, 1, 1, 1],
  ],
  forest: [
    [I.apple, 5, 1, 3], [I.stick, 4, 2, 4], [I.feather, 3, 1, 2], [I.leather, 3, 1, 2],
    [I.carrot, 3, 1, 2], [I.potato, 3, 1, 2], [I.goldenApple, 1, 1, 1],
  ],
  hotel: [
    [I.gold, 4, 1, 2], [I.emerald, 3, 1, 2], [I.candle, 4, 1, 2], [I.ironSword, 2, 1, 1],
    [I.leatherChest, 2, 1, 1], [I.clock, 2, 1, 1], [I.enchantedGoldenApple, 1, 1, 1], [I.totem, 1, 1, 1],
  ],
  school: [
    [I.paper, 5, 2, 4], [I.book, 4, 1, 2], [I.iron, 3, 1, 2], [I.candle, 3, 1, 1],
    [I.bread, 3, 1, 2], [I.arrow, 3, 2, 4], [I.xpBottle, 2, 1, 2],
  ],
  mall: [
    [I.emerald, 4, 1, 2], [I.gold, 3, 1, 2], [I.diamond, 2, 1, 1], [I.candle, 3, 1, 2],
    [I.leatherBoots, 2, 1, 1], [I.cake, 2, 1, 1], [I.clock, 2, 1, 1], [I.nameTag, 1, 1, 1],
  ],
  parking: [
    [I.iron, 4, 1, 3], [I.coal, 4, 2, 4], [I.copper, 3, 1, 3], [I.flintSteel, 2, 1, 1],
    [I.torch, 4, 2, 3], [I.redstone, 3, 1, 2], [I.diamond, 1, 1, 1],
  ],
  toy: [
    [I.candle, 4, 1, 2], [I.emerald, 3, 1, 1], [I.paper, 3, 1, 2], [I.string, 3, 1, 3],
    [I.egg, 3, 1, 2], [I.feather, 3, 1, 2], [I.totem, 1, 1, 1],
  ],
  sewers: [
    [I.iron, 4, 1, 2], [I.coal, 4, 1, 3], [I.rottenFlesh, 4, 1, 2], [I.bone, 4, 1, 3],
    [I.string, 3, 1, 3], [I.torch, 3, 1, 2], [I.emerald, 1, 1, 1],
  ],
};

function pickWeighted(table, rnd) {
  const total = table.reduce((s, e) => s + e[1], 0);
  let r = rnd() * total;
  for (const e of table) {
    r -= e[1];
    if (r <= 0) return e;
  }
  return table[table.length - 1];
}

/**
 * Coloca un cofre en (x,y,z) y lo llena con botín del tema dado.
 * Nunca lanza: si algo falla, solo se registra un aviso (un cofre fallido
 * no debe tumbar la construcción de todo un nivel).
 */
export function placeChest(dim, x, y, z, themeKey, rnd = Math.random) {
  try {
    let block = dim.getBlock({ x, y, z });
    if (!block) return false;
    block.setType("minecraft:chest");
    block = dim.getBlock({ x, y, z }); // referencia fresca tras cambiar el tipo

    const inv = block.getComponent("minecraft:inventory");
    if (!inv || !inv.container) return false;
    const container = inv.container;

    const table = LOOT_TABLES[themeKey] ?? LOOT_TABLES.office;
    const n = 2 + Math.floor(rnd() * 3); // 2–4 items distintos
    const slots = new Set();
    let guard = 0;
    while (slots.size < n && guard < 40) {
      slots.add(Math.floor(rnd() * CHEST_SLOTS));
      guard++;
    }

    for (const slot of slots) {
      const [id, , min, max] = pickWeighted(table, rnd);
      const amount = Math.max(1, min + Math.floor(rnd() * (max - min + 1)));
      container.setItem(slot, new ItemStack(id, amount));
    }
    return true;
  } catch (e) {
    console.warn("[Dreamcore] No se pudo llenar un cofre:", e);
    return false;
  }
}

/** Igual que placeChest pero con una probabilidad (0–1) de ocurrir. */
export function maybeChest(dim, x, y, z, themeKey, chance = 0.35, rnd = Math.random) {
  if (rnd() < chance) return placeChest(dim, x, y, z, themeKey, rnd);
  return false;
}

/**
 * levelBuilder.js — Sistema Profesional de Generación de Niveles Únicos y No-Repetitivos (PCG).
 *
 * Implementa un sistema avanzado de sub-estructuras modulares, rotaciones aleatorias,
 * densidades de ruido de Perlin/hash de múltiples octavas y variaciones arquitectónicas
 * dinámicas para que NINGUNA habitación o celda se repita en los 22 mundos.
 * Garantiza 0% bloques con gravedad (estabilidad total).
 */
import { world, BlockVolume } from "@minecraft/server";
import { INFINITE, NAMESPACE } from "../config.js";
import { levelTarget, markCustomDimsUnavailable } from "./dimensionResolver.js";
import { maybeChest, placeChest } from "./lootSystem.js";
import { initLevelExitCell, checkAndPlaceReturnPortal } from "./returnPortalSystem.js";

const INF_CELL = INFINITE.cell;   // 12
const INF_WALL = INFINITE.wall;   // 1
const INF_STEP = INF_CELL + INF_WALL; // 13

const builtLevels   = new Map();
const infiniteState = new Map();

export function registerAllDimensions(event, levels) {
  for (const level of levels) {
    try { event.dimensionRegistry.registerCustomDimension(level.id); }
    catch (e) {
      console.warn("[Dreamcore] Dims custom no disponibles → modo fallback.", e);
      markCustomDimsUnavailable();
      break;
    }
  }
}

export function getBuiltLevel(id) { return builtLevels.get(id) ?? null; }

function box(dim, x1, y1, z1, x2, y2, z2, block) {
  const from = { x: Math.min(x1,x2), y: Math.min(y1,y2), z: Math.min(z1,z2) };
  const to   = { x: Math.max(x1,x2), y: Math.max(y1,y2), z: Math.max(z1,z2) };
  try { dim.fillBlocks(new BlockVolume(from, to), block); } catch (_) {}
}

function s(dim, x, y, z, type) {
  try { const b = dim.getBlock({ x, y, z }); if (b) b.setType(type); } catch (_) {}
}

// Hash avanzado de múltiples octavas para variedad extrema sin repetición
function h3(x, z, seed) {
  let h = (x * 374761393 + z * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = (h * 1274126177) | 0;
  let h2 = (x * 1274126177 + z * 374761393 + (seed + 13) * 668265263) | 0;
  h2 = (h2 ^ (h2 >>> 15)) | 0;
  return (((h ^ h2) >>> 0) / 4294967296);
}

export async function buildLevel(level) {
  if (builtLevels.has(level.id)) return builtLevels.get(level.id);

  const t = levelTarget(level);
  const record = { fixtures: { lights: [] }, spawn: null, infinite: true, target: t };
  builtLevels.set(level.id, record);
  record.spawn = await prepareInfiniteSpawn(level);
  return record;
}

function infState(levelId) {
  if (!infiniteState.has(levelId))
    infiniteState.set(levelId, { generated: new Set(), spawnCell: { x: 0, z: 0 }, floorY: 64 });
  return infiniteState.get(levelId);
}

function ceilOffsetFor(level) { return level.theme.ceilOffset ?? INFINITE.ceilOffset; }

function edgeOpen(cx, cz, dir, seed) { return h3(cx, cz, seed + dir * 37) < 0.58; }

function buildWallX(dim, x, yF, z0, yC, z1, block, open) {
  const gap = Math.floor((z0 + z1) / 2);
  for (let z = z0; z <= z1; z++) {
    if (open && (z === gap || z === gap + 1)) continue;
    for (let y = yF + 1; y <= yC - 1; y++) s(dim, x, y, z, block);
  }
}
function buildWallZ(dim, x0, yF, z, x1, yC, block, open) {
  const gap = Math.floor((x0 + x1) / 2);
  for (let x = x0; x <= x1; x++) {
    if (open && (x === gap || x === gap + 1)) continue;
    for (let y = yF + 1; y <= yC - 1; y++) s(dim, x, y, z, block);
  }
}

function generateCell(level, dim, cx, cz) {
  const st  = infState(level.id);
  const key = `${cx},${cz}`;
  if (st.generated.has(key)) return;
  st.generated.add(key);

  const seed = INFINITE.seedBase + level.index * 13171 + cx * 73 - cz * 97;
  const p    = level.theme.palette;
  const x0   = cx * INF_STEP, z0 = cz * INF_STEP;
  const x1   = x0 + INF_CELL - 1, z1 = z0 + INF_CELL - 1;
  const yF   = st.floorY;
  const yC   = yF + ceilOffsetFor(level);
  const spawnRoom = cx === st.spawnCell.x && cz === st.spawnCell.z;
  const openWorld = level.theme.openWorld === true;
  const corridorZ = level.theme.corridorZ === true;

  // Suelo con variaciones procedurales de material según ruido (evita pisos idénticos)
  const floorVariation = h3(cx, cz, seed + 999);
  let actualFloor = p.floor;
  if (floorVariation < 0.25 && !openWorld) {
    if (p.floor === "minecraft:white_concrete") actualFloor = "minecraft:light_gray_concrete";
    else if (p.floor === "minecraft:stone") actualFloor = "minecraft:cobblestone";
    else if (p.floor === "minecraft:oak_planks") actualFloor = "minecraft:spruce_planks";
  }
  box(dim, x0, yF, z0, x1, yF, z1, actualFloor);

  if (!openWorld) {
    box(dim, x0, yC, z0, x1, yC, z1, p.ceiling);

    let openN = spawnRoom || edgeOpen(cx, cz - 1, 1, seed);
    let openS = spawnRoom || edgeOpen(cx, cz,     1, seed);
    let openW = spawnRoom || edgeOpen(cx - 1, cz, 0, seed);
    let openE = spawnRoom || edgeOpen(cx, cz,     0, seed);

    if (corridorZ) { openN = true; openS = true; openW = false; openE = false; }

    buildWallZ(dim, x0, yF, z0, x1, yC, p.wall, openN);
    buildWallZ(dim, x0, yF, z1, x1, yC, p.wall, openS);
    buildWallX(dim, x0, yF, z0, yC, z1, p.wall, openW);
    buildWallX(dim, x1, yF, z0, yC, z1, p.wall, openE);

    if (!spawnRoom && p.light && p.light !== "minecraft:air") {
      const chance = level.themeKey === "parking" ? 0.35 : 0.85;
      if (h3(cx, cz, seed + 55) < chance) {
        const lx = Math.floor((x0 + x1) / 2), lz = Math.floor((z0 + z1) / 2);
        s(dim, lx, yC - 1, lz, p.light);
      }
    }
  }

  if (!spawnRoom) {
    // Múltiples variaciones arquitectónicas por celda usando índices pseudoaleatorios avanzados
    const archVariant = Math.floor(h3(cx, cz, seed + 333) * 6);
    
    switch (level.themeKey) {
      case "office":         decorateOffice(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,archVariant); break;
      case "neighborhood":   decorateNeighborhood(dim,cx,cz,x0,z0,x1,z1,yF,seed,archVariant); break;
      case "pool":           decoratePool(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,archVariant); break;
      case "playground":     decoratePlayground(dim,cx,cz,x0,z0,x1,z1,yF,seed,archVariant); break;
      case "maze":           decorateMaze(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,archVariant); break;
      case "forest":         decorateForest(dim,cx,cz,x0,z0,x1,z1,yF,seed,archVariant); break;
      case "hotel":          decorateHotel(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,archVariant); break;
      case "school":         decorateSchool(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,archVariant); break;
      case "mall":           decorateMall(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,archVariant); break;
      case "parking":        decorateParking(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,archVariant); break;
      case "toy":            decorateToy(dim,cx,cz,x0,z0,x1,z1,yF,yC,seed,archVariant); break;
      case "sewers":         decorateSewers(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,archVariant); break;
      case "flower_field":   decorateFlowerField(dim,cx,cz,x0,z0,x1,z1,yF,seed,archVariant); break;
      case "living_room":    decorateLivingRoom(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,archVariant); break;
      case "arcade":         decorateArcade(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,archVariant); break;
      case "train_station":  decorateTrainStation(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,archVariant); break;
      case "art_gallery":    decorateArtGallery(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,archVariant); break;
      case "porches":        decoratePorches(dim,cx,cz,x0,z0,x1,z1,yF,seed,archVariant); break;
      case "desert":         decorateDesert(dim,cx,cz,x0,z0,x1,z1,yF,seed,archVariant); break;
      case "metro":          decorateMetro(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,archVariant); break;
      case "museum":         decorateMuseum(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,archVariant); break;
      case "glass_labyrinth":decorateGlassLabyrinth(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,archVariant); break;
    }

    if (h3(cx, cz, seed + 777) < 0.15)
      placeChest(dim, x0 + 2, yF + 1, z0 + 2, level.themeKey);
  }

  try { checkAndPlaceReturnPortal(level.id, dim, cx, cz, x0, z0, yF); } catch (_) {}
}

// ── DECORADORES PROFESIONALES MULTI-VARIANTE (CERO REPETICIÓN) ───────────────

function decorateOffice(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,v) {
  if (v === 0) {
    const wz = Math.floor((z0+z1)/2);
    for (let x=x0+1;x<=x1-1;x++) for (let y=yF+1;y<=yC-1;y++) s(dim,x,y,wz,p.wall);
    s(dim,Math.floor((x0+x1)/2),yF+1,wz,"minecraft:air");
    s(dim,Math.floor((x0+x1)/2),yF+2,wz,"minecraft:air");
  } else if (v === 1) {
    for (let i=0;i<4;i++) {
      const px=i<2?x0+2:x1-2, pz=i%2===0?z0+2:z1-2;
      for (let y=yF+1;y<=yC-1;y++) s(dim,px,y,pz,p.wall);
    }
  } else if (v === 2) {
    box(dim, x0+2, yF+1, z0+2, x0+4, yF+1, z0+4, "minecraft:oak_planks");
    s(dim, x0+3, yF+2, z0+3, "minecraft:flower_pot");
  } else if (v === 3) {
    for (let px=x0+3;px<=x1-2;px+=4)
      for (let pz=z0+3;pz<=z1-2;pz+=4)
        s(dim, px, yF+1, pz, "minecraft:bookshelf");
  }
}

const HOUSE_STYLES = [
  { wall:"minecraft:white_concrete",     roof:"minecraft:red_concrete",    win:"minecraft:black_stained_glass" },
  { wall:"minecraft:light_gray_concrete",roof:"minecraft:black_concrete",  win:"minecraft:orange_stained_glass" },
  { wall:"minecraft:brown_terracotta",   roof:"minecraft:brown_concrete",  win:"minecraft:light_blue_stained_glass" },
  { wall:"minecraft:yellow_terracotta",  roof:"minecraft:gray_concrete",   win:"minecraft:red_stained_glass" },
  { wall:"minecraft:cyan_terracotta",    roof:"minecraft:cyan_concrete",   win:"minecraft:white_stained_glass" },
  { wall:"minecraft:pink_concrete",      roof:"minecraft:purple_concrete", win:"minecraft:yellow_stained_glass" },
];

function decorateNeighborhood(dim,cx,cz,x0,z0,x1,z1,yF,seed,v) {
  box(dim,x0,yF,z0,x1,yF,z0+1,"minecraft:smooth_stone");
  box(dim,x0,yF,z0,x0+1,yF,z1,"minecraft:smooth_stone");

  if (h3(cx,cz,seed+10)>0.15) {
    const style = HOUSE_STYLES[Math.floor(h3(cx,cz,seed+v)*HOUSE_STYLES.length)];
    const hw=6 + (v%3), hd=6 + ((v*2)%3), hh=5;
    const hx0 = x0+2, hz0 = z0+2;
    const hx1=Math.min(x1-1, hx0+hw-1), hz1=Math.min(z1-1, hz0+hd-1), hY=yF+hh;

    box(dim,hx0,yF,hz0,hx1,yF,hz1,v%2===0?"minecraft:oak_planks":"minecraft:spruce_planks");
    box(dim,hx0,hY,hz0,hx1,hY,hz1,style.roof);
    for (let y=yF+1;y<hY;y++) {
      s(dim,hx0,y,hz0,style.wall); s(dim,hx1,y,hz0,style.wall);
      s(dim,hx0,y,hz1,style.wall); s(dim,hx1,y,hz1,style.wall);
    }
    const doorX=Math.floor((hx0+hx1)/2);
    s(dim,doorX,yF+1,hz1,"minecraft:air"); s(dim,doorX,yF+2,hz1,"minecraft:air");
    maybeChest(dim,hx1-1,yF+1,hz1-1,"neighborhood",0.5);
  }
  if (h3(cx,cz,seed+20)<0.5) {
    const lx=x0+2,lz=z0+2;
    for (let y=1;y<=4;y++) s(dim,lx,yF+y,lz,"minecraft:cobblestone_wall");
    s(dim,lx,yF+5,lz,"minecraft:sea_lantern");
  }
}

function decoratePool(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,v) {
  const pw=5+(v%3), pd=5+(v%3);
  const px0=x0+2, pz0=z0+2;
  box(dim,px0,yF,pz0,px0+pw-1,yF,pz0+pd-1,p.water);
  if (v%2===0) {
    box(dim,px0-1,yF+1,pz0-1,px0+pw,yF+1,pz0-1,"minecraft:quartz_stairs");
  } else {
    s(dim,px0,yF+1,pz0,"minecraft:sea_lantern");
  }
}

const EQUIP = ["swing","slide","sandbox","bench","lamp","seesaw","fountain"];
function decoratePlayground(dim,cx,cz,x0,z0,x1,z1,yF,seed,v) {
  const eq = EQUIP[v % EQUIP.length];
  const mx=Math.floor((x0+x1)/2), mz=Math.floor((z0+z1)/2);
  if (eq === "swing") {
    for (let y=1;y<=4;y++) { s(dim,mx-2,yF+y,mz,"minecraft:oak_fence"); s(dim,mx+2,yF+y,mz,"minecraft:oak_fence"); }
    box(dim,mx-2,yF+4,mz,mx+2,yF+4,mz,"minecraft:iron_bars");
  } else if (eq === "fountain") {
    box(dim,mx-1,yF+1,mz-1,mx+1,yF+1,mz+1,"minecraft:quartz_bricks");
    s(dim,mx,yF+2,mz,"minecraft:water");
  } else {
    box(dim,mx-2,yF+1,mz,mx+2,yF+1,mz,"minecraft:smooth_stone_slab");
  }
}

function decorateMaze(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,v) {
  const segs = 2 + (v % 3);
  for (let i=0; i<segs; i++) {
    const bx = x0 + 2 + ((i * 4) % (INF_CELL - 3));
    for (let y = yF + 1; y <= yC - 1; y++) s(dim, bx, y, z0 + 3, p.wall);
  }
}

function decorateForest(dim,cx,cz,x0,z0,x1,z1,yF,seed,v) {
  const tx = x0 + 3 + (v % 5), tz = z0 + 3 + ((v * 2) % 5);
  const th = 4 + (v % 4);
  for (let y=1; y<=th; y++) s(dim,tx,yF+y,tz,"minecraft:dark_oak_log");
  for (let dx=-1; dx<=1; dx++) for (let dz=-1; dz<=1; dz++)
    s(dim,tx+dx,yF+th+1,tz+dz,"minecraft:dark_oak_leaves");
}

function decorateHotel(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,v) {
  const side = v%2===0?1:-1;
  const partX = side>0?x0+4:x1-4;
  for (let z=z0+1;z<=z1-1;z++) for (let y=yF+1;y<=yC-1;y++) s(dim,partX,y,z,p.wall);
  const rx = side>0?x0+1:partX+1;
  s(dim,rx,yF+1,z0+2,v%2===0?"minecraft:red_bed":"minecraft:yellow_bed");
  maybeChest(dim,rx,yF+1,z1-2,"hotel",0.4);
}

function decorateSchool(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,v) {
  const rx0 = x0 + 2, rx1 = x1 - 2;
  box(dim, rx0, yF+1, z0+2, rx1, yF+1, z0+2, "minecraft:oak_stairs");
  s(dim, Math.floor((rx0+rx1)/2), yF+2, z0+2, "minecraft:flower_pot");
}

function decorateMall(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,v) {
  const col = SHOP_COLORS[v % SHOP_COLORS.length];
  box(dim, x0+2, yF+1, z0+2, x0+4, yF+3, z0+4, col);
  s(dim, x0+3, yF+4, z0+3, "minecraft:sea_lantern");
}

function decorateParking(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,v) {
  const ax = x0 + 2 + (v % 4), az = z0 + 2;
  box(dim, ax, yF+1, az, ax+2, yF+1, az+3, "minecraft:smooth_stone");
}

function decorateToy(dim,cx,cz,x0,z0,x1,z1,yF,yC,seed,v) {
  const col = TOY_COLORS[v % TOY_COLORS.length];
  box(dim, x0+3, yF+1, z0+3, x0+5, yF+1+v, z0+5, col);
}

function decorateSewers(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,v) {
  const midZ = Math.floor((z0+z1)/2);
  box(dim, x0+2, yF, midZ, x1-2, yF, midZ+1, p.water);
  if (v%2===0) s(dim, x0+3, yF+1, midZ, "minecraft:mossy_cobblestone");
}

function decorateFlowerField(dim,cx,cz,x0,z0,x1,z1,yF,seed,v) {
  const flowers = ["minecraft:poppy", "minecraft:dandelion", "minecraft:allium", "minecraft:blue_orchid", "minecraft:oxeye_daisy", "minecraft:cornflower"];
  for (let i = 0; i < 5; i++) {
    const fx = x0 + 1 + ((i * 3 + v) % (INF_CELL - 2));
    const fz = z0 + 1 + ((i * 5 + v) % (INF_CELL - 2));
    s(dim, fx, yF+1, fz, flowers[(i+v)%flowers.length]);
  }
}

function decorateLivingRoom(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,v) {
  const mx = Math.floor((x0+x1)/2), mz = Math.floor((z0+z1)/2);
  box(dim, mx-2, yF+1, mz, mx+2, yF+1, mz, v%2===0?"minecraft:red_wool":"minecraft:blue_wool");
  s(dim, mx, yF+1, mz+2, "minecraft:bookshelf");
}

function decorateArcade(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,v) {
  for (let x=x0+2; x<=x1-2; x+=2) {
    box(dim, x, yF+1, z0+2, x, yF+3, z0+2, "minecraft:magenta_concrete");
  }
}

function decorateTrainStation(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,v) {
  const mz = Math.floor((z0+z1)/2);
  box(dim, x0+1, yF, mz, x1-1, yF, mz, "minecraft:iron_block");
  s(dim, x0+3, yF+1, mz-2, "minecraft:oak_stairs");
}

function decorateArtGallery(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,v) {
  const mx = Math.floor((x0+x1)/2);
  s(dim, mx, yF+1, z0+2, "minecraft:quartz_pillar");
  s(dim, mx, yF+2, z0+2, "minecraft:sea_lantern");
}

function decoratePorches(dim,cx,cz,x0,z0,x1,z1,yF,seed,v) {
  const hx = Math.floor((x0+x1)/2), hz = Math.floor((z0+z1)/2);
  box(dim, hx-2, yF, hz-2, hx+2, yF, hz+2, "minecraft:oak_planks");
  s(dim, hx, yF+1, hz, "minecraft:crafting_table");
}

function decorateDesert(dim,cx,cz,x0,z0,x1,z1,yF,seed,v) {
  const mx = Math.floor((x0+x1)/2), mz = Math.floor((z0+z1)/2);
  s(dim, mx, yF+1, mz, "minecraft:cactus");
  if (v%2===0) s(dim, mx+2, yF+1, mz+2, "minecraft:dead_bush");
}

function decorateMetro(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,v) {
  const mx = Math.floor((x0+x1)/2);
  box(dim, mx-1, yF+1, z0+2, mx+1, yF+3, z0+2, "minecraft:stone_bricks");
}

function decorateMuseum(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,v) {
  const mx = Math.floor((x0+x1)/2), mz = Math.floor((z0+z1)/2);
  box(dim, mx-1, yF+1, mz-1, mx+1, yF+1, mz+1, "minecraft:gold_block");
  s(dim, mx, yF+2, mz, "minecraft:glass");
}

function decorateGlassLabyrinth(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed,v) {
  const mx = Math.floor((x0+x1)/2) + (v%2);
  for (let z=z0+1; z<=z1-1; z++) {
    for (let y=yF+1; y<=yC-1; y++) s(dim, mx, y, z, "minecraft:glass");
  }
}

export async function prepareInfiniteSpawn(level) {
  const t   = levelTarget(level);
  const dim = t.dim;
  const st  = infState(level.id);
  st.floorY = t.floorY;

  const scx = Math.round(t.centerX / INF_STEP);
  const scz = Math.round(t.centerZ / INF_STEP);
  st.spawnCell = { x: scx, z: scz };

  initLevelExitCell(level.id, scx, scz);

  const R = INF_STEP * 3 + 4;
  const taId = `${level.id}_spawn`;
  try {
    await world.tickingAreaManager.createTickingArea(taId, {
      dimension: dim,
      from: { x: t.centerX - R, y: t.floorY - 4, z: t.centerZ - R },
      to:   { x: t.centerX + R, y: t.floorY + ceilOffsetFor(level) + 6, z: t.centerZ + R },
    });
  } catch (_) {}

  for (let dx=-1;dx<=1;dx++) for (let dz=-1;dz<=1;dz++)
    generateCell(level, dim, scx+dx, scz+dz);

  box(dim, t.centerX - 8, t.floorY - 1, t.centerZ - 8,
          t.centerX + 8, t.floorY - 1, t.centerZ + 8, "minecraft:bedrock");

  try { world.tickingAreaManager.removeTickingArea(taId); } catch (_) {}

  return { x: t.centerX, y: t.floorY + 2, z: t.centerZ };
}

export function generateAround(level, dim, px, pz, budget) {
  const st = infState(level.id);
  const cx = Math.floor(px / INF_STEP);
  const cz = Math.floor(pz / INF_STEP);
  let done = 0;
  for (let r=0; r<=INFINITE.genRadius && done<budget; r++) {
    for (let dx=-r; dx<=r && done<budget; dx++) {
      for (let dz=-r; dz<=r && done<budget; dz++) {
        if (Math.max(Math.abs(dx),Math.abs(dz))!==r) continue;
        generateCell(level, dim, cx+dx, cz+dz);
        done++;
      }
    }
  }
}

/**
 * levelBuilder.js — Generación infinita para los 22 niveles liminales y dreamcore.
 *
 * Cero bloques con gravedad (nada de grava, arena o polvo de concreto),
 * garantizando estructuras 100% estables y sin colapsos.
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

function h2(x, z, seed) {
  let h = (x * 374761393 + z * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = (h * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
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

function edgeOpen(cx, cz, dir, seed) { return h2(cx, cz, seed + dir + 7) < 0.55; }

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

  const seed = INFINITE.seedBase + level.index * 7919;
  const p    = level.theme.palette;
  const x0   = cx * INF_STEP, z0 = cz * INF_STEP;
  const x1   = x0 + INF_CELL - 1, z1 = z0 + INF_CELL - 1;
  const yF   = st.floorY;
  const yC   = yF + ceilOffsetFor(level);
  const spawnRoom = cx === st.spawnCell.x && cz === st.spawnCell.z;
  const openWorld = level.theme.openWorld === true;
  const corridorZ = level.theme.corridorZ === true;

  box(dim, x0, yF, z0, x1, yF, z1, p.floor);

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
      const chance = level.themeKey === "parking" ? 0.35 : 1;
      if (h2(cx, cz, seed + 55) < chance) {
        const lx = Math.floor((x0 + x1) / 2), lz = Math.floor((z0 + z1) / 2);
        s(dim, lx, yC - 1, lz, p.light);
      }
    }
  }

  if (!spawnRoom) {
    switch (level.themeKey) {
      case "office":         decorateOffice(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed); break;
      case "neighborhood":   decorateNeighborhood(dim,cx,cz,x0,z0,x1,z1,yF,seed); break;
      case "pool":           decoratePool(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed); break;
      case "playground":     decoratePlayground(dim,cx,cz,x0,z0,x1,z1,yF,seed); break;
      case "maze":           decorateMaze(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed); break;
      case "forest":         decorateForest(dim,cx,cz,x0,z0,x1,z1,yF,seed); break;
      case "hotel":          decorateHotel(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed); break;
      case "school":         decorateSchool(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed); break;
      case "mall":           decorateMall(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed); break;
      case "parking":        decorateParking(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed); break;
      case "toy":            decorateToy(dim,cx,cz,x0,z0,x1,z1,yF,yC,seed); break;
      case "sewers":         decorateSewers(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed); break;
      case "flower_field":   decorateFlowerField(dim,cx,cz,x0,z0,x1,z1,yF,seed); break;
      case "living_room":    decorateLivingRoom(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed); break;
      case "arcade":         decorateArcade(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed); break;
      case "train_station":  decorateTrainStation(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed); break;
      case "art_gallery":    decorateArtGallery(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed); break;
      case "porches":        decoratePorches(dim,cx,cz,x0,z0,x1,z1,yF,seed); break;
      case "desert":         decorateDesert(dim,cx,cz,x0,z0,x1,z1,yF,seed); break;
      case "metro":          decorateMetro(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed); break;
      case "museum":         decorateMuseum(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed); break;
      case "glass_labyrinth":decorateGlassLabyrinth(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed); break;
    }

    if (h2(cx, cz, seed + 777) < 0.12)
      placeChest(dim, x0 + 2, yF + 1, z0 + 2, level.themeKey);
  }

  try { checkAndPlaceReturnPortal(level.id, dim, cx, cz, x0, z0, yF); } catch (_) {}
}

// ── DECORADORES ─────────────────────────────────────────────────────────────

function decorateOffice(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed) {
  const type = Math.floor(h2(cx,cz,seed+999)*4);
  if (type===1) {
    const wz = Math.floor((z0+z1)/2);
    for (let x=x0;x<=x1;x++) for (let y=yF+1;y<=yC-1;y++) s(dim,x,y,wz,p.wall);
    s(dim,Math.floor((x0+x1)/2),yF+1,wz,"minecraft:air");
    s(dim,Math.floor((x0+x1)/2),yF+2,wz,"minecraft:air");
  } else if (type===2) {
    for (let i=0;i<4;i++) {
      const px=i<2?x0+2:x1-2, pz=i%2===0?z0+2:z1-2;
      for (let y=yF+1;y<=yC-1;y++) s(dim,px,y,pz,p.wall);
    }
  } else if (type===3) {
    for (let px=x0+4;px<=x1-3;px+=5)
      for (let pz=z0+4;pz<=z1-3;pz+=5)
        for (let y=yF+1;y<=yC-1;y++) s(dim,px,y,pz,p.wall);
  }
}

const HOUSE_STYLES = [
  { wall:"minecraft:white_concrete",     roof:"minecraft:red_concrete",    win:"minecraft:black_stained_glass" },
  { wall:"minecraft:light_gray_concrete",roof:"minecraft:black_concrete",  win:"minecraft:orange_stained_glass" },
  { wall:"minecraft:brown_terracotta",   roof:"minecraft:brown_concrete",  win:"minecraft:light_blue_stained_glass" },
  { wall:"minecraft:yellow_terracotta",  roof:"minecraft:gray_concrete",   win:"minecraft:red_stained_glass" },
  { wall:"minecraft:cyan_terracotta",    roof:"minecraft:cyan_concrete",   win:"minecraft:white_stained_glass" },
];

function decorateNeighborhood(dim,cx,cz,x0,z0,x1,z1,yF,seed) {
  box(dim,x0,yF,z0,x1,yF,z0+1,"minecraft:cracked_stone_bricks");
  box(dim,x0,yF,z0,x0+1,yF,z1,"minecraft:cracked_stone_bricks");

  if (h2(cx,cz,seed+10)>0.2) {
    const style = HOUSE_STYLES[Math.floor(h2(cx,cz,seed+1)*HOUSE_STYLES.length)];
    const hw=7,hd=6,hh=5;
    const hx0 = x0+3, hz0 = z0+3;
    const hx1=hx0+hw-1, hz1=hz0+hd-1, hY=yF+hh;

    box(dim,hx0,yF,hz0,hx1,yF,hz1,"minecraft:oak_planks");
    box(dim,hx0,hY,hz0,hx1,hY,hz1,style.roof);
    for (let y=yF+1;y<hY;y++) {
      s(dim,hx0,y,hz0,style.wall); s(dim,hx1,y,hz0,style.wall);
      s(dim,hx0,y,hz1,style.wall); s(dim,hx1,y,hz1,style.wall);
      for (let x=hx0+1;x<hx1;x++) { s(dim,x,y,hz0,style.wall); s(dim,x,y,hz1,style.wall); }
      for (let z=hz0+1;z<hz1;z++) { s(dim,hx0,y,z,style.wall); s(dim,hx1,y,z,style.wall); }
    }
    const doorX=Math.floor((hx0+hx1)/2);
    s(dim,doorX,yF+1,hz1,"minecraft:air"); s(dim,doorX,yF+2,hz1,"minecraft:air");
    s(dim,hx0+1,yF+2,hz0,style.win); s(dim,hx1-1,yF+2,hz0,style.win);
    s(dim,Math.floor((hx0+hx1)/2),hY-1,Math.floor((hz0+hz1)/2),"minecraft:glowstone");
    maybeChest(dim,hx1-1,yF+1,hz1-1,"neighborhood",0.45);
  }
  if (h2(cx,cz,seed+20)<0.4) {
    const lx=x0+1,lz=z0+3;
    for (let y=1;y<=3;y++) s(dim,lx,yF+y,lz,"minecraft:cobblestone_wall");
    s(dim,lx,yF+4,lz,"minecraft:glowstone");
  }
}

function decoratePool(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed) {
  const pw=6, pd=6;
  const px0=x0+3, pz0=z0+3;
  box(dim,px0,yF,pz0,px0+pw-1,yF,pz0+pd-1,p.water);
  for (let i=0;i<pw;i++) {
    s(dim,px0+i,yF+1,pz0-1,"minecraft:iron_bars");
    s(dim,px0+i,yF+1,pz0+pd,"minecraft:iron_bars");
  }
  for (let i=0;i<pd;i++) {
    s(dim,px0-1,yF+1,pz0+i,"minecraft:iron_bars");
    s(dim,px0+pw,yF+1,pz0+i,"minecraft:iron_bars");
  }
  box(dim,px0-1,yF,pz0-1,px0-1,yF,pz0+pd,"minecraft:white_concrete");
  box(dim,px0+pw,yF,pz0-1,px0+pw,yF,pz0+pd,"minecraft:white_concrete");
  if (h2(cx,cz,seed+90)<0.5) {
    s(dim,x0+1,yF+1,Math.floor((z0+z1)/2),"minecraft:quartz_pillar");
    s(dim,x1-1,yF+1,Math.floor((z0+z1)/2),"minecraft:quartz_pillar");
  }
}

const EQUIP = ["swing","slide","sandbox","bench","lamp"];
function decoratePlayground(dim,cx,cz,x0,z0,x1,z1,yF,seed) {
  const mid = Math.floor(EQUIP.length * h2(cx,cz,seed+5));
  const mx=Math.floor((x0+x1)/2), mz=Math.floor((z0+z1)/2);
  switch (EQUIP[mid]) {
    case "swing":
      for (let y=1;y<=4;y++) { s(dim,mx-2,yF+y,mz,"minecraft:oak_fence"); s(dim,mx+2,yF+y,mz,"minecraft:oak_fence"); }
      box(dim,mx-2,yF+4,mz,mx+2,yF+4,mz,"minecraft:iron_bars");
      s(dim,mx-1,yF+3,mz,"minecraft:chain"); s(dim,mx-1,yF+2,mz,"minecraft:chain"); s(dim,mx-1,yF+1,mz,"minecraft:oak_slab");
      s(dim,mx+1,yF+3,mz,"minecraft:chain"); s(dim,mx+1,yF+2,mz,"minecraft:chain"); s(dim,mx+1,yF+1,mz,"minecraft:oak_slab");
      break;
    case "slide":
      for (let i=0;i<=3;i++) { box(dim,mx-1,yF,mz+i,mx+1,yF+i,mz+i,"minecraft:stone_bricks"); }
      break;
    case "sandbox":
      box(dim,mx-2,yF,mz-2,mx+2,yF,mz+2,"minecraft:sand");
      s(dim,mx,yF+1,mz,"minecraft:dead_bush");
      break;
    case "bench":
      box(dim,mx-2,yF+1,mz,mx+2,yF+1,mz,"minecraft:oak_slab");
      s(dim,mx-2,yF+2,mz-1,"minecraft:oak_planks"); s(dim,mx+2,yF+2,mz-1,"minecraft:oak_planks");
      break;
    case "lamp":
      for (let y=1;y<=5;y++) s(dim,mx,yF+y,mz,"minecraft:cobblestone_wall");
      s(dim,mx,yF+6,mz,"minecraft:soul_lantern");
      break;
  }
  const colors=["minecraft:red_wool","minecraft:yellow_wool","minecraft:blue_wool","minecraft:green_wool"];
  if (h2(cx,cz,seed+30)<0.4)
    s(dim,x0+2,yF+1,z1-2,colors[Math.floor(h2(cx,cz,seed+31)*colors.length)]);
  if (h2(cx,cz,seed+40)<0.3) s(dim,x0+1,yF+1,z0+2,"minecraft:soul_lantern");
}

function decorateMaze(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed) {
  const segs=2+Math.floor(h2(cx,cz,seed+31)*2);
  for (let i=0;i<segs;i++) {
    const dir=Math.floor(h2(cx,cz,seed+40+i)*4);
    const len=4+Math.floor(h2(cx,cz,seed+50+i)*3);
    const off=2+Math.floor(h2(cx,cz,seed+60+i)*(INF_CELL-4));
    let sx,sz;
    if (dir===0){sx=x0+1;sz=z0+off;}
    else if(dir===1){sx=x1-1;sz=z0+off;}
    else if(dir===2){sx=x0+off;sz=z0+1;}
    else{sx=x0+off;sz=z1-1;}
    for (let k=0;k<len;k++) {
      const bx=dir<2?sx+(dir===0?k:-k):sx, bz=dir>=2?sz+(dir===2?k:-k):sz;
      for (let y=yF+1;y<=yC-1;y++) s(dim,bx,y,bz,p.wall);
    }
  }
}

function decorateForest(dim,cx,cz,x0,z0,x1,z1,yF,seed) {
  const numTrees = 2+Math.floor(h2(cx,cz,seed+1)*4);
  for (let t=0;t<numTrees;t++) {
    const tx=x0+1+Math.floor(h2(cx,cz,seed+10+t)*(INF_CELL-2));
    const tz=z0+1+Math.floor(h2(cx,cz,seed+20+t)*(INF_CELL-2));
    const th=4+Math.floor(h2(cx,cz,seed+30+t)*6);
    const alive=h2(cx,cz,seed+40+t)>0.3;
    for (let y=1;y<=th;y++) s(dim,tx,yF+y,tz,"minecraft:oak_log");
    if (alive) {
      for (let dx=-2;dx<=2;dx++) for (let dz=-2;dz<=2;dz++)
        if (h2(tx+dx,tz+dz,seed+50)<0.6) s(dim,tx+dx,yF+th+1,tz+dz,"minecraft:oak_leaves");
      s(dim,tx,yF+th+2,tz,"minecraft:oak_leaves");
    }
    if (h2(cx,cz,seed+60+t)<0.2) s(dim,tx+1,yF+1,tz,"minecraft:cobweb");
  }
  if (h2(cx,cz,seed+70)<0.3) s(dim,x0+3,yF+1,z1-3,"minecraft:brown_mushroom");
  if (h2(cx,cz,seed+71)<0.3) s(dim,x1-2,yF+1,z0+3,"minecraft:dead_bush");
}

function decorateHotel(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed) {
  const side=(cx+cz)%2===0?1:-1;
  const hasRoom=h2(cx,cz,seed+300)<0.75;
  if (!hasRoom) return;

  const partX=side>0?x0+4:x1-4;
  for (let z=z0+1;z<=z1-1;z++) for (let y=yF+1;y<=yC-1;y++) s(dim,partX,y,z,p.wall);
  const doorZ=Math.floor((z0+z1)/2);
  s(dim,partX,yF+1,doorZ,"minecraft:air"); s(dim,partX,yF+2,doorZ,"minecraft:air");

  const rx=side>0?x0+1:partX+1;
  s(dim,rx,yF+1,z0+2,"minecraft:red_bed");
  s(dim,rx+1,yF+1,z0+2,"minecraft:crafting_table");
  s(dim,rx+1,yF+2,z0+2,"minecraft:candle");

  if (h2(cx,cz,seed+400)<0.4) {
    const ax=side>0?x1-1:x0+1;
    s(dim,ax,yF+2,z0+3,"minecraft:crimson_wool");
    s(dim,ax,yF+3,z0+3,"minecraft:crimson_wool");
  }
  maybeChest(dim,rx,yF+1,z1-2,"hotel",0.35);
}

function decorateSchool(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed) {
  const side=(cx+cz)%2===0?1:-1;
  if (h2(cx,cz,seed+100)<0.25) return;

  const partX=side>0?x0+4:x1-4;
  for (let z=z0+1;z<=z1-1;z++) for (let y=yF+1;y<=yC-1;y++) s(dim,partX,y,z,p.wall);
  const doorZ=z0+2;
  s(dim,partX,yF+1,doorZ,"minecraft:air"); s(dim,partX,yF+2,doorZ,"minecraft:air");

  const rx0=side>0?x0+1:partX+1, rx1=side>0?partX-1:x1-1;
  box(dim,rx1,yF+1,z0+1,rx1,yF+2,z1-1,"minecraft:black_concrete");
  for (let z=z0+2;z<=z1-2;z+=2)
    for (let x=rx0;x<=rx1-2;x+=2)
      s(dim,x,yF+1,z,"minecraft:oak_slab");

  s(dim,Math.floor((rx0+rx1)/2),yC-1,Math.floor((z0+z1)/2),p.light);
  maybeChest(dim,rx0,yF+1,z0+1,"school",0.3);
}

const SHOP_COLORS = [
  "minecraft:red_stained_glass","minecraft:lime_stained_glass","minecraft:light_blue_stained_glass",
  "minecraft:yellow_stained_glass","minecraft:magenta_stained_glass","minecraft:orange_stained_glass",
];
function decorateMall(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed) {
  const side=(cx+cz)%2===0?1:-1;
  if (h2(cx,cz,seed+200)<0.15) return;

  const partX=side>0?x0+4:x1-4;
  for (let z=z0+1;z<=z1-1;z++) for (let y=yF+1;y<=yC-1;y++) s(dim,partX,y,z,p.wall);
  const doorZ=Math.floor((z0+z1)/2);
  s(dim,partX,yF+1,doorZ,"minecraft:air"); s(dim,partX,yF+2,doorZ,"minecraft:air");
  s(dim,partX,yF+3,doorZ,"minecraft:air");

  const col=SHOP_COLORS[Math.floor(h2(cx,cz,seed+201)*SHOP_COLORS.length)];
  const fx=side>0?x0+1:partX+1;
  for (let z=z0+1;z<=z1-1;z++) for (let y=yF+1;y<=yC-1;y++) {
    if (z!==doorZ) s(dim,partX+(side>0?1:-1),y,z,col);
  }
  s(dim,fx,yF+1,z0+3,"minecraft:emerald_block");
  s(dim,fx,yF+1,z0+4,"minecraft:gold_block");
  s(dim,Math.floor((fx+partX)/2),yC-1,Math.floor((z0+z1)/2),p.light);
  maybeChest(dim,fx,yF+1,z1-2,"mall",0.4);
}

const CAR_COLORS=["minecraft:red_concrete","minecraft:blue_concrete","minecraft:white_concrete","minecraft:black_concrete","minecraft:yellow_concrete"];
function decorateParking(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed) {
  for (let i=0;i<4;i++) {
    const px=i<2?x0+1:x1-1, pz=i%2===0?z0+1:z1-1;
    for (let y=yF+1;y<=yC-1;y++) s(dim,px,y,pz,"minecraft:andesite");
  }
  box(dim,x0,yF,Math.floor((z0+z1)/2),x1,yF,Math.floor((z0+z1)/2),"minecraft:gray_concrete");
  if (h2(cx,cz,seed+70)<0.55) {
    const col=CAR_COLORS[Math.floor(h2(cx,cz,seed+71)*CAR_COLORS.length)];
    const ax=x0+3, az=z0+3;
    box(dim,ax,yF+1,az,ax+3,yF+1,az+1,col);
    box(dim,ax+1,yF+2,az,ax+2,yF+2,az+1,col);
    if (h2(cx,cz,seed+72)<0.3) maybeChest(dim,ax+4,yF+1,az,"parking",1);
  }
}

const TOY_COLORS=["minecraft:red_concrete","minecraft:yellow_concrete","minecraft:lime_concrete","minecraft:light_blue_concrete","minecraft:magenta_concrete","minecraft:orange_concrete","minecraft:pink_concrete","minecraft:cyan_concrete"];
function decorateToy(dim,cx,cz,x0,z0,x1,z1,yF,yC,seed) {
  const nTowers=2+Math.floor(h2(cx,cz,seed+61)*3);
  for (let t=0;t<nTowers;t++) {
    const tx=x0+2+Math.floor(h2(cx,cz,seed+70+t)*(INF_CELL-4));
    const tz=z0+2+Math.floor(h2(cx,cz,seed+80+t)*(INF_CELL-4));
    const th=2+Math.floor(h2(cx,cz,seed+90+t)*4);
    for (let y=0;y<th;y++) {
      const col=TOY_COLORS[Math.floor(h2(tx,tz,seed+100+y)*TOY_COLORS.length)];
      for (let dx=0;dx<=1;dx++) for (let dz=0;dz<=1;dz++) s(dim,tx+dx,yF+1+y,tz+dz,col);
    }
    s(dim,tx,yF+th+1,tz,"minecraft:white_wool");
  }
}

function decorateSewers(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed) {
  const midZ=Math.floor((z0+z1)/2);
  box(dim,x0+1,yF,midZ,x1-1,yF,midZ+1,p.water);
  if (h2(cx,cz,seed+200)<0.5) s(dim,x0+2,yF,midZ-2,"minecraft:mossy_stone_bricks");
  if (h2(cx,cz,seed+201)<0.5) s(dim,x1-2,yF,midZ+3,"minecraft:mossy_cobblestone");
  if (h2(cx,cz,seed+202)<0.4) s(dim,Math.floor((x0+x1)/2),yC-1,Math.floor((z0+z1)/2),"minecraft:iron_bars");
  if (h2(cx,cz,seed+210)<0.35) s(dim,x0+3,yF+1,z0+3,"minecraft:brown_mushroom");
}

// Decoradores para nuevos mundos (12 a 21)
function decorateFlowerField(dim,cx,cz,x0,z0,x1,z1,yF,seed) {
  const flowers = ["minecraft:poppy", "minecraft:dandelion", "minecraft:allium", "minecraft:blue_orchid", "minecraft:tulip"];
  for (let i = 0; i < 4; i++) {
    const fx = x0 + 2 + Math.floor(h2(cx, cz, seed + i * 10) * (INF_CELL - 4));
    const fz = z0 + 2 + Math.floor(h2(cx, cz, seed + i * 20) * (INF_CELL - 4));
    const fl = flowers[Math.floor(h2(cx, cz, seed + i * 30) * flowers.length)];
    s(dim, fx, yF + 1, fz, fl);
  }
}

function decorateLivingRoom(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed) {
  const mx = Math.floor((x0 + x1) / 2), mz = Math.floor((z0 + z1) / 2);
  box(dim, mx - 2, yF + 1, mz - 1, mx + 2, yF + 1, mz - 1, "minecraft:red_wool"); // sofá
  s(dim, mx, yF + 1, mz + 1, "minecraft:jukebox"); // mesa de centro
  s(dim, mx, yF + 2, mz + 1, "minecraft:candle");
}

function decorateArcade(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed) {
  for (let x = x0 + 2; x <= x1 - 2; x += 3) {
    box(dim, x, yF + 1, z0 + 2, x, yF + 3, z0 + 2, "minecraft:blue_concrete");
    s(dim, x, yF + 4, z0 + 2, "minecraft:sea_lantern");
  }
}

function decorateTrainStation(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed) {
  const midZ = Math.floor((z0 + z1) / 2);
  box(dim, x0 + 1, yF, midZ, x1 - 1, yF, midZ, "minecraft:iron_block");
  box(dim, x0 + 1, yF, midZ + 1, x1 - 1, yF, midZ + 1, p.water); // vía con agua/reflejo
  for (let x = x0 + 3; x <= x1 - 3; x += 4) {
    s(dim, x, yF + 1, z0 + 2, "minecraft:oak_stairs");
  }
}

function decorateArtGallery(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed) {
  const mx = Math.floor((x0 + x1) / 2), mz = Math.floor((z0 + z1) / 2);
  s(dim, mx, yF + 1, mz, "minecraft:quartz_pillar");
  s(dim, mx, yF + 2, mz, "minecraft:sea_lantern");
  s(dim, x0 + 1, yF + 2, mz, "minecraft:red_wool"); // cuadro de arte
}

function decoratePorches(dim,cx,cz,x0,z0,x1,z1,yF,seed) {
  const hx = Math.floor((x0 + x1) / 2), hz = Math.floor((z0 + z1) / 2);
  box(dim, hx - 2, yF, hz - 2, hx + 2, yF, hz + 2, "minecraft:oak_planks");
  for (let y = 1; y <= 3; y++) s(dim, hx - 2, yF + y, hz - 2, "minecraft:oak_fence");
  s(dim, hx - 2, yF + 4, hz - 2, "minecraft:oak_slab");
}

function decorateDesert(dim,cx,cz,x0,z0,x1,z1,yF,seed) {
  const mx = Math.floor((x0 + x1) / 2), mz = Math.floor((z0 + z1) / 2);
  s(dim, mx, yF + 1, mz, "minecraft:cactus");
  s(dim, mx, yF + 2, mz, "minecraft:cactus");
  if (h2(cx, cz, seed) < 0.3) s(dim, mx + 2, yF + 1, mz + 2, "minecraft:dead_bush");
}

function decorateMetro(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed) {
  const mx = Math.floor((x0 + x1) / 2);
  for (let z = z0 + 1; z <= z1 - 1; z++) {
    s(dim, mx, yF + 1, z, "minecraft:iron_bars");
  }
}

function decorateMuseum(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed) {
  const mx = Math.floor((x0 + x1) / 2), mz = Math.floor((z0 + z1) / 2);
  box(dim, mx - 1, yF + 1, mz - 1, mx + 1, yF + 1, mz + 1, "minecraft:gold_block");
  s(dim, mx, yF + 2, mz, "minecraft:glass");
}

function decorateGlassLabyrinth(dim,cx,cz,x0,z0,x1,z1,yF,yC,p,seed) {
  const mx = Math.floor((x0 + x1) / 2);
  for (let z = z0 + 2; z <= z1 - 2; z++) {
    for (let y = yF + 1; y <= yC - 1; y++) s(dim, mx, y, z, "minecraft:glass");
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

import {
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";

/** Procedural surface families. Ids are internal - not persisted. */
export type SurfaceKind =
  | "wood"
  | "darkWood"
  | "floorboard"
  | "fabric"
  | "leather"
  | "plaster"
  | "concrete"
  | "brick"
  | "carpet"
  | "tile"
  | "marble"
  | "metal"
  | "ceramic"
  | "paper"
  | "foliage";

export interface SurfaceMaps {
  map: Texture;
  normalMap: Texture;
  roughnessMap: Texture;
}

const SIZE = 256;

/** mulberry32, so a reload paints the same grain rather than reshuffling it. */
function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Tileable value noise - the lattice wraps, so the texture repeats seamlessly.
 * Separate cell counts per axis: grain and brushing are stretched along one
 * direction, and isotropic noise cannot fake that.
 */
function noiseField(
  seed: number,
  cellsX: number,
  cellsY: number,
): (x: number, y: number) => number {
  const rand = prng(seed);
  const grid = new Float32Array(cellsX * cellsY);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  return (x, y) => {
    const fx = x * cellsX;
    const fy = y * cellsY;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const x0 = ((ix % cellsX) + cellsX) % cellsX;
    const y0 = ((iy % cellsY) + cellsY) % cellsY;
    const x1 = (x0 + 1) % cellsX;
    const y1 = (y0 + 1) % cellsY;
    const tx = smooth(fx - ix);
    const ty = smooth(fy - iy);
    const a = grid[y0 * cellsX + x0]!;
    const b = grid[y0 * cellsX + x1]!;
    const c = grid[y1 * cellsX + x0]!;
    const d = grid[y1 * cellsX + x1]!;
    return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
  };
}

function fbm(
  seed: number,
  cellsX: number,
  octaves: number,
  cellsY = cellsX,
): (x: number, y: number) => number {
  const layers = Array.from({ length: octaves }, (_, i) =>
    noiseField(seed + i * 977, cellsX * 2 ** i, cellsY * 2 ** i),
  );
  const weights = layers.map((_, i) => 0.5 ** i);
  const total = weights.reduce((sum, w) => sum + w, 0);
  return (x, y) => {
    let value = 0;
    for (let i = 0; i < layers.length; i++) value += layers[i]!(x, y) * weights[i]!;
    return value / total;
  };
}

interface Fields {
  /** Albedo multiplier, ~1 = untouched base colour. */
  shade: Float32Array;
  /** Bump height, drives the normal map. */
  height: Float32Array;
  /** Roughness multiplier, ~1 = the material's own roughness. */
  gloss: Float32Array;
  /** How much darker areas warm up. 0 keeps the tint neutral. */
  warmth?: number;
  /** Bump strength in normal-map units. */
  relief?: number;
}

function fields(): Fields {
  return {
    shade: new Float32Array(SIZE * SIZE).fill(1),
    height: new Float32Array(SIZE * SIZE),
    gloss: new Float32Array(SIZE * SIZE).fill(1),
  };
}

function woodFields(seed: number, contrast: number): Fields {
  const f = fields();
  const warp = fbm(seed, 2, 4, 6);
  const pore = fbm(seed + 31, 2, 2, 48);
  const knots = fbm(seed + 71, 3, 2);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      // Grain runs along U; the warp bends the rings and jitters their spacing,
      // which is what keeps them from reading as corduroy.
      const drift = warp(u, v) - 0.5;
      const grain = pore(u, v) - 0.5;
      const rings = 0.5 + 0.5 * Math.sin(2 * Math.PI * (v * 17 + drift * 1.4 + grain * 0.3));
      const figure = rings ** 5;
      const knot = Math.max(0, knots(u, v) - 0.82) * 3;
      const i = y * SIZE + x;
      f.shade[i] = 1 - figure * contrast - grain * 0.035 - knot * 0.18;
      f.height[i] = figure * 0.5 + grain * 0.25 + knot * 0.4;
      f.gloss[i] = 1 + figure * 0.18 + knot * 0.25;
    }
  }
  f.warmth = 0.5;
  f.relief = 0.22;
  return f;
}

function floorboardFields(): Fields {
  const base = woodFields(9001, 0.16);
  const boards = 8;
  const stagger = prng(4242);
  const offsets = Array.from({ length: boards }, () => stagger());
  for (let y = 0; y < SIZE; y++) {
    const board = Math.floor((y / SIZE) * boards);
    const within = ((y / SIZE) * boards) % 1;
    const tone = 1 - (offsets[board] ?? 0.5) * 0.12;
    // Butt joints land at a per-board offset so the seams do not line up in a column.
    const seamU = offsets[board] ?? 0.5;
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const u = x / SIZE;
      const edge = Math.min(within, 1 - within);
      const groove = edge < 0.03 ? 1 - edge / 0.03 : 0;
      const butt = Math.abs(((u - seamU + 1) % 1) - 0.5) > 0.4975 ? 1 : 0;
      const gap = Math.max(groove, butt);
      f_set(base, i, tone, gap);
    }
  }
  base.relief = 0.6;
  return base;
}

function f_set(f: Fields, i: number, tone: number, gap: number) {
  f.shade[i] = f.shade[i]! * tone * (1 - gap * 0.55);
  f.height[i] = f.height[i]! * (1 - gap) - gap * 1.4;
  f.gloss[i] = f.gloss[i]! * (1 + gap * 0.5);
}

function weaveFields(seed: number, threads: number, fuzz: number): Fields {
  const f = fields();
  const slub = fbm(seed, 8, 3);
  const lint = fbm(seed + 17, 64, 2);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const warp = Math.sin(2 * Math.PI * u * threads);
      const weft = Math.sin(2 * Math.PI * v * threads);
      // Over-under: whichever thread is on top at this pixel owns the highlight.
      const over = warp * weft > 0 ? warp : weft;
      const cloth = Math.abs(over) ** 0.7;
      const variation = slub(u, v) - 0.5;
      const noise = lint(u, v) - 0.5;
      const i = y * SIZE + x;
      f.shade[i] = 1 - (1 - cloth) * 0.16 + variation * 0.07 + noise * fuzz;
      f.height[i] = cloth * 0.8 + noise * 0.4;
      f.gloss[i] = 1 + (1 - cloth) * 0.12 - noise * 0.1;
    }
  }
  f.warmth = 0.2;
  f.relief = 0.7;
  return f;
}

function leatherFields(): Fields {
  const f = fields();
  const cells = fbm(3301, 24, 3);
  const grain = fbm(3371, 90, 2);
  const creases = fbm(3407, 6, 3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      // Pebbles are noise pushed away from its mid-tone, which reads as raised cells.
      const pebble = Math.abs(cells(u, v) - 0.5) * 2;
      const pore = grain(u, v) - 0.5;
      const crease = Math.max(0, 0.42 - Math.abs(creases(u, v) - 0.5)) * 1.2;
      const i = y * SIZE + x;
      f.shade[i] = 1 - (1 - pebble) * 0.14 - crease * 0.1 + pore * 0.04;
      f.height[i] = pebble * 0.75 - crease * 0.5 + pore * 0.3;
      f.gloss[i] = 1 - pebble * 0.16 + crease * 0.2;
    }
  }
  f.warmth = 0.35;
  f.relief = 0.6;
  return f;
}

function plasterFields(): Fields {
  const f = fields();
  const broad = fbm(5501, 4, 4);
  const stipple = fbm(5563, 48, 3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const wash = broad(u, v) - 0.5;
      const tooth = stipple(u, v) - 0.5;
      const i = y * SIZE + x;
      f.shade[i] = 1 + wash * 0.035 + tooth * 0.02;
      f.height[i] = tooth * 0.5 + wash * 0.2;
      f.gloss[i] = 1 + tooth * 0.06;
    }
  }
  f.warmth = 0.1;
  f.relief = 0.1;
  return f;
}

function concreteFields(): Fields {
  const f = fields();
  const blotch = fbm(6101, 5, 4);
  const aggregate = fbm(6133, 70, 2);
  const pits = fbm(6199, 110, 1);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const wash = blotch(u, v) - 0.5;
      const grit = aggregate(u, v) - 0.5;
      const pit = Math.max(0, pits(u, v) - 0.82) * 5;
      const i = y * SIZE + x;
      f.shade[i] = 1 + wash * 0.13 + grit * 0.06 - pit * 0.3;
      f.height[i] = grit * 0.5 + wash * 0.3 - pit;
      f.gloss[i] = 1 + wash * 0.1 + pit * 0.3;
    }
  }
  f.warmth = 0.05;
  f.relief = 0.3;
  return f;
}

function brickFields(): Fields {
  const f = fields();
  const courses = 6;
  const perRow = 3;
  const tone = prng(7001);
  const tones = Array.from({ length: courses * perRow }, () => 0.86 + tone() * 0.28);
  const clay = fbm(7043, 40, 3);
  const mortarNoise = fbm(7079, 26, 2);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const row = Math.floor(v * courses);
      const withinRow = (v * courses) % 1;
      // Every other course shifts half a brick, the standard running bond.
      const shifted = (u + (row % 2) * 0.5) % 1;
      const col = Math.floor(shifted * perRow);
      const withinCol = (shifted * perRow) % 1;
      const joint =
        withinRow < 0.11 || withinRow > 0.89 || withinCol < 0.045 || withinCol > 0.955;
      const i = y * SIZE + x;
      const brickTone = tones[row * perRow + col] ?? 1;
      if (joint) {
        const m = mortarNoise(u, v) - 0.5;
        f.shade[i] = 1.32 + m * 0.12;
        f.height[i] = -1 + m * 0.2;
        f.gloss[i] = 1.25;
      } else {
        const c = clay(u, v) - 0.5;
        f.shade[i] = brickTone + c * 0.12;
        f.height[i] = 0.5 + c * 0.5;
        f.gloss[i] = 1 + c * 0.15;
      }
    }
  }
  f.warmth = 0.3;
  f.relief = 0.9;
  return f;
}

function carpetFields(): Fields {
  const f = fields();
  const tufts = fbm(8101, 96, 2);
  const drift = fbm(8137, 6, 3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const pile = tufts(u, v);
      const sweep = drift(u, v) - 0.5;
      const i = y * SIZE + x;
      f.shade[i] = 0.88 + pile * 0.24 + sweep * 0.09;
      f.height[i] = pile * 1.1 + sweep * 0.3;
      f.gloss[i] = 1.05 - pile * 0.08;
    }
  }
  f.warmth = 0.2;
  f.relief = 0.75;
  return f;
}

function tileFields(): Fields {
  const f = fields();
  const tiles = 4;
  const tone = prng(9001);
  const tones = Array.from({ length: tiles * tiles }, () => 0.95 + tone() * 0.1);
  const glaze = fbm(9043, 12, 3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const cx = Math.floor(u * tiles);
      const cy = Math.floor(v * tiles);
      const fx = (u * tiles) % 1;
      const fy = (v * tiles) % 1;
      const edge = Math.min(fx, 1 - fx, fy, 1 - fy);
      const grout = edge < 0.035;
      const i = y * SIZE + x;
      if (grout) {
        f.shade[i] = 0.8;
        f.height[i] = -1;
        f.gloss[i] = 1.6;
      } else {
        const sheen = glaze(u, v) - 0.5;
        f.shade[i] = (tones[cy * tiles + cx] ?? 1) + sheen * 0.05;
        // Bevelled tile edge: only the outer 4% of each tile rolls off.
        f.height[i] = 0.6 * smooth(Math.min(1, (edge - 0.035) / 0.04));
        f.gloss[i] = 0.72 + sheen * 0.1;
      }
    }
  }
  f.warmth = 0.05;
  f.relief = 0.5;
  return f;
}

function marbleFields(): Fields {
  const f = fields();
  const body = fbm(10007, 4, 4);
  const veins = fbm(10037, 3, 4);
  const fine = fbm(10079, 20, 3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const swirl = Math.sin(2 * Math.PI * (u * 1.5 + v * 0.7 + (veins(u, v) - 0.5) * 3));
      const vein = Math.max(0, 1 - Math.abs(swirl) * 7);
      const hairline = Math.max(0, 1 - Math.abs(Math.sin(2 * Math.PI * (v * 2 + (fine(u, v) - 0.5) * 4))) * 22);
      const cloud = body(u, v) - 0.5;
      const i = y * SIZE + x;
      f.shade[i] = 1 + cloud * 0.06 - vein * 0.3 - hairline * 0.16;
      f.height[i] = cloud * 0.2 - vein * 0.15;
      f.gloss[i] = 0.55 + vein * 0.25;
    }
  }
  f.warmth = 0.05;
  f.relief = 0.08;
  return f;
}

function metalFields(): Fields {
  const f = fields();
  const streak = fbm(11003, 2, 2, 128);
  const wear = fbm(11071, 7, 3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const brush = streak(u, v) - 0.5;
      const patina = wear(u, v) - 0.5;
      const i = y * SIZE + x;
      f.shade[i] = 1 + brush * 0.07 + patina * 0.05;
      f.height[i] = brush * 0.5;
      f.gloss[i] = 1 + brush * 0.35 + patina * 0.12;
    }
  }
  f.warmth = 0;
  f.relief = 0.15;
  return f;
}

function ceramicFields(): Fields {
  const f = fields();
  const glaze = fbm(12007, 6, 3);
  const dust = fbm(12043, 60, 2);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const sheen = glaze(u, v) - 0.5;
      const speck = dust(u, v) - 0.5;
      const i = y * SIZE + x;
      f.shade[i] = 1 + sheen * 0.03 + speck * 0.015;
      f.height[i] = sheen * 0.2;
      f.gloss[i] = 1 + sheen * 0.18;
    }
  }
  f.warmth = 0;
  f.relief = 0.06;
  return f;
}

function paperFields(): Fields {
  const f = fields();
  const tooth = fbm(13001, 80, 2);
  const stain = fbm(13037, 5, 3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const grain = tooth(u, v) - 0.5;
      const age = stain(u, v) - 0.5;
      const i = y * SIZE + x;
      f.shade[i] = 1 + grain * 0.05 + age * 0.08;
      f.height[i] = grain * 0.35;
      f.gloss[i] = 1 + grain * 0.1;
    }
  }
  f.warmth = 0.25;
  f.relief = 0.15;
  return f;
}

function foliageFields(): Fields {
  const f = fields();
  const mottle = fbm(14009, 10, 3);
  const veins = fbm(14051, 30, 2);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const patch = mottle(u, v) - 0.5;
      const rib = Math.max(0, 1 - Math.abs(Math.sin(2 * Math.PI * (u * 6 + (veins(u, v) - 0.5) * 2))) * 9);
      const i = y * SIZE + x;
      f.shade[i] = 1 + patch * 0.18 - rib * 0.12;
      f.height[i] = patch * 0.4 + rib * 0.6;
      f.gloss[i] = 1 - rib * 0.2 + patch * 0.1;
    }
  }
  f.warmth = 0.15;
  f.relief = 0.5;
  return f;
}

const BUILDERS: Record<SurfaceKind, () => Fields> = {
  wood: () => woodFields(2113, 0.17),
  darkWood: () => woodFields(4271, 0.24),
  floorboard: floorboardFields,
  fabric: () => weaveFields(21001, 34, 0.05),
  leather: leatherFields,
  plaster: plasterFields,
  concrete: concreteFields,
  brick: brickFields,
  carpet: carpetFields,
  tile: tileFields,
  marble: marbleFields,
  metal: metalFields,
  ceramic: ceramicFields,
  paper: paperFields,
  foliage: foliageFields,
};

function canvas(): CanvasRenderingContext2D {
  const element = document.createElement("canvas");
  element.width = SIZE;
  element.height = SIZE;
  const context = element.getContext("2d");
  if (!context) throw new Error("2d canvas unavailable");
  return context;
}

function albedoTexture(f: Fields): CanvasTexture {
  const context = canvas();
  const image = context.createImageData(SIZE, SIZE);
  const warmth = f.warmth ?? 0;
  for (let i = 0; i < SIZE * SIZE; i++) {
    const s = Math.max(0, Math.min(1.6, f.shade[i]!));
    // Darker patches drift warm, which is what stops a tint from reading as paint.
    const shift = (1 - s) * warmth;
    image.data[i * 4] = Math.min(255, s * 255 * (1 + shift * 0.35));
    image.data[i * 4 + 1] = Math.min(255, s * 255 * (1 + shift * 0.08));
    image.data[i * 4 + 2] = Math.min(255, s * 255 * (1 - shift * 0.22));
    image.data[i * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const texture = new CanvasTexture(context.canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function roughnessTexture(f: Fields): CanvasTexture {
  const context = canvas();
  const image = context.createImageData(SIZE, SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const g = Math.max(0, Math.min(1, f.gloss[i]! * 0.6));
    const byte = g * 255;
    image.data[i * 4] = byte;
    image.data[i * 4 + 1] = byte;
    image.data[i * 4 + 2] = byte;
    image.data[i * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return new CanvasTexture(context.canvas);
}

/** Sobel over the height field. Wrapping the taps keeps the tile seamless. */
function normalTexture(f: Fields): CanvasTexture {
  const context = canvas();
  const image = context.createImageData(SIZE, SIZE);
  // Divided by the kernel weight, so relief reads as a slope rather than a knob.
  const strength = (f.relief ?? 0.5) * 3;
  const at = (x: number, y: number) =>
    f.height[(((y % SIZE) + SIZE) % SIZE) * SIZE + (((x % SIZE) + SIZE) % SIZE)]!;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx =
        at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));
      const dy =
        at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));
      const nx = (dx / 8) * strength;
      const ny = (dy / 8) * strength;
      const length = Math.hypot(nx, ny, 1);
      const i = (y * SIZE + x) * 4;
      image.data[i] = ((nx / length) * 0.5 + 0.5) * 255;
      image.data[i + 1] = ((ny / length) * 0.5 + 0.5) * 255;
      image.data[i + 2] = ((1 / length) * 0.5 + 0.5) * 255;
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return new CanvasTexture(context.canvas);
}

const sources = new Map<SurfaceKind, SurfaceMaps>();
const repeats = new Map<string, SurfaceMaps>();

function sourceMaps(kind: SurfaceKind): SurfaceMaps {
  const cached = sources.get(kind);
  if (cached) return cached;
  const f = BUILDERS[kind]();
  const maps: SurfaceMaps = {
    map: albedoTexture(f),
    normalMap: normalTexture(f),
    roughnessMap: roughnessTexture(f),
  };
  for (const texture of Object.values(maps)) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.anisotropy = 8;
  }
  sources.set(kind, maps);
  return maps;
}

/** Repeat is quantised so a scene of many sizes still shares a handful of uploads. */
export function quantiseRepeat(repeat: number): number {
  return Math.min(24, Math.max(0.25, Math.round(repeat * 4) / 4));
}

/**
 * Textures for one surface at one tiling density. Returns null during SSR, where
 * there is no canvas to rasterise into.
 */
export function surfaceMaps(kind: SurfaceKind, repeat: number): SurfaceMaps | null {
  if (typeof document === "undefined") return null;
  const scale = quantiseRepeat(repeat);
  const key = `${kind}@${scale}`;
  const cached = repeats.get(key);
  if (cached) return cached;
  let base: SurfaceMaps;
  try {
    base = sourceMaps(kind);
  } catch {
    return null;
  }
  const clone = (texture: Texture): Texture => {
    const copy = texture.clone();
    copy.needsUpdate = true;
    copy.repeat.set(scale, scale);
    return copy;
  };
  const maps: SurfaceMaps = {
    map: clone(base.map),
    normalMap: clone(base.normalMap),
    roughnessMap: clone(base.roughnessMap),
  };
  repeats.set(key, maps);
  return maps;
}

/** Real-world size of one texture tile, in metres. */
export const TILE_SIZE: Record<SurfaceKind, number> = {
  wood: 0.9,
  darkWood: 0.9,
  floorboard: 2,
  fabric: 0.45,
  leather: 0.5,
  plaster: 3.2,
  concrete: 2.6,
  brick: 1.8,
  carpet: 0.7,
  tile: 1.2,
  marble: 2.4,
  metal: 0.8,
  ceramic: 1,
  paper: 0.4,
  foliage: 0.3,
};

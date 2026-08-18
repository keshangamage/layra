import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Shape,
} from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

interface Entry {
  geometry: BufferGeometry;
  users: number;
  sweep?: ReturnType<typeof setTimeout>;
}

const cache = new Map<string, Entry>();

function acquire(key: string, build: () => BufferGeometry): BufferGeometry {
  const existing = cache.get(key);
  if (existing) return existing.geometry;
  const created: Entry = { geometry: build(), users: 0 };
  cache.set(key, created);
  return created.geometry;
}

function retain(key: string): void {
  const entry = cache.get(key);
  if (!entry) return;
  entry.users += 1;
  if (entry.sweep) {
    clearTimeout(entry.sweep);
    entry.sweep = undefined;
  }
}

function release(key: string): void {
  const entry = cache.get(key);
  if (!entry) return;
  entry.users -= 1;
  if (entry.users > 0) return;
  // Deferred: Strict Mode unmounts and immediately remounts, and disposing in
  // between would hand the remount a dead geometry.
  entry.sweep = setTimeout(() => {
    if (entry.users > 0) return;
    entry.geometry.dispose();
    cache.delete(key);
  }, 0);
}

/**
 * Ref-counted geometry, shared by every mesh asking for the same shape. A
 * sofa's four legs, a dresser's six drawer fronts and six identical dining
 * chairs all collapse onto one buffer.
 */
export function useSharedGeometry(key: string, build: () => BufferGeometry): BufferGeometry {
  // build closes over the same values the key encodes, so key alone is the dep.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => acquire(key, build), [key]);

  useEffect(() => {
    retain(key);
    return () => release(key);
  }, [key]);

  return geometry;
}

const EPS = 0.00001;

function roundedShape(width: number, height: number, radius: number): Shape {
  const shape = new Shape();
  const r = radius - EPS;
  shape.absarc(EPS, EPS, EPS, -Math.PI / 2, -Math.PI, true);
  shape.absarc(EPS, height - r * 2, EPS, Math.PI, Math.PI / 2, true);
  shape.absarc(width - r * 2, height - r * 2, EPS, Math.PI / 2, 0, true);
  shape.absarc(width - r * 2, EPS, EPS, 0, -Math.PI / 2, true);
  return shape;
}

/**
 * UVs measured in metres, projected per face from the creased normal.
 *
 * ExtrudeGeometry's own UVs mix metres on the caps with normalised values on
 * the side walls, so grain scale drifted with the size of the piece. Every
 * surface should show the same real-world grain whatever it is wrapped around.
 */
function metreUVs(geometry: BufferGeometry): void {
  const position = geometry.attributes.position!;
  const normal = geometry.attributes.normal!;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (nx >= ny && nx >= nz) {
      uv[i * 2] = z;
      uv[i * 2 + 1] = y;
    } else if (ny >= nz) {
      uv[i * 2] = x;
      uv[i * 2 + 1] = z;
    } else {
      uv[i * 2] = x;
      uv[i * 2 + 1] = y;
    }
  }
  geometry.setAttribute("uv", new BufferAttribute(uv, 2));
}

function buildRoundedBox(
  width: number,
  height: number,
  depth: number,
  radius: number,
  smoothness: number,
): BufferGeometry {
  const geometry = new ExtrudeGeometry(roundedShape(width, height, radius), {
    depth: depth - radius * 2,
    bevelEnabled: true,
    bevelSegments: smoothness * 2,
    steps: 1,
    bevelSize: radius - EPS,
    bevelThickness: radius,
    curveSegments: smoothness,
  });
  geometry.center();
  toCreasedNormals(geometry, 0.5);
  metreUVs(geometry);
  return geometry;
}

const round = (value: number) => Math.round(value * 10000) / 10000;

export function useRoundedBox(
  width: number,
  height: number,
  depth: number,
  radius: number,
  smoothness = 3,
): BufferGeometry {
  const key = `box|${round(width)}|${round(height)}|${round(depth)}|${round(radius)}|${smoothness}`;
  return useSharedGeometry(key, () =>
    buildRoundedBox(width, height, depth, radius, smoothness),
  );
}

export function useCylinder(
  top: number,
  bottom: number,
  height: number,
  segments: number,
): BufferGeometry {
  const key = `cyl|${round(top)}|${round(bottom)}|${round(height)}|${segments}`;
  return useSharedGeometry(key, () => new CylinderGeometry(top, bottom, height, segments, 1));
}

import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import type { MeshData } from "@layra/geometry";

/**
 * UVs in metres, so one texture tile covers a fixed real-world size however the
 * room is shaped. Vertical faces are projected onto their own horizontal
 * tangent rather than the nearest axis, or a diagonal wall would squash its
 * texture by the cosine of its angle.
 */
function worldUVs(positions: Float32Array, normals: Float32Array): Float32Array {
  const uv = new Float32Array((positions.length / 3) * 2);
  for (let i = 0; i < positions.length; i += 3) {
    const nx = normals[i]!;
    const ny = normals[i + 1]!;
    const nz = normals[i + 2]!;
    const px = positions[i]!;
    const py = positions[i + 1]!;
    const pz = positions[i + 2]!;
    const j = (i / 3) * 2;
    if (Math.abs(ny) > 0.7) {
      uv[j] = px;
      uv[j + 1] = pz;
    } else {
      const len = Math.hypot(nz, nx) || 1;
      uv[j] = (px * nz - pz * nx) / len;
      uv[j + 1] = py;
    }
  }
  return uv;
}

/** Rebuilds only when the mesh data changes, and disposes the old geometry. */
export function useMeshGeometry(data: MeshData): BufferGeometry {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(data.positions, 3));
    g.setAttribute("normal", new BufferAttribute(data.normals, 3));
    g.setAttribute("uv", new BufferAttribute(worldUVs(data.positions, data.normals), 2));
    g.setIndex(new BufferAttribute(data.indices, 1));
    g.computeBoundingSphere();
    return g;
  }, [data]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return geometry;
}

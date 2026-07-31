import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import type { MeshData } from "@layra/geometry";

/** Rebuilds only when the mesh data changes, and disposes the old geometry. */
export function useMeshGeometry(data: MeshData): BufferGeometry {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(data.positions, 3));
    g.setAttribute("normal", new BufferAttribute(data.normals, 3));
    g.setIndex(new BufferAttribute(data.indices, 1));
    g.computeBoundingSphere();
    return g;
  }, [data]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return geometry;
}

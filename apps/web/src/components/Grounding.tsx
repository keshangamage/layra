"use client";

import { ContactShadows } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Postprocessing } from "./Postprocessing";

/**
 * Contact shading, by whichever route this machine can afford.
 *
 * The two are mutually exclusive on purpose. Beyond doubling the darkening,
 * ContactShadows renders into its own target with a bare gl.render and never
 * clears it, while the effect composer forces autoClear off for as long as it
 * is mounted - so running both leaves every frame's silhouettes stacked on the
 * floor.
 */
export function Grounding({
  radius,
  center,
  scale,
}: {
  radius: number;
  center: [number, number, number];
  scale: number;
}) {
  // A full-screen AO pass is unusable on a software rasteriser, and headless
  // Chromium runs one. Unknown renderers are assumed to be real hardware.
  const software = useThree((state) => {
    const context = state.gl.getContext();
    const info = context.getExtension("WEBGL_debug_renderer_info");
    const name = info ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    return /swiftshader|llvmpipe|software/i.test(name);
  });

  if (!software) return <Postprocessing radius={radius} />;

  return (
    <ContactShadows
      position={center}
      opacity={0.45}
      scale={scale}
      blur={2}
      // Short range on purpose: this is contact darkening under furniture, so
      // anything as tall as a wall must not register and cast a slab of grey.
      far={0.7}
      resolution={1024}
      color="#150f0a"
    />
  );
}

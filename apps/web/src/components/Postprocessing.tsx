"use client";

import { EffectComposer, N8AO, SMAA, ToneMapping } from "@react-three/postprocessing";
import { useThree } from "@react-three/fiber";
import { ToneMappingMode } from "postprocessing";

/**
 * Ambient occlusion, plus the antialiasing and tone mapping the composer takes
 * over. Nothing else darkens where a sofa meets a floor or where a bookshelf
 * bay turns a corner, and that contact shading is most of what separates a
 * render from a diagram.
 */
export function Postprocessing({ radius }: { radius: number }) {
  // A full-screen AO pass is unusable on a software rasteriser, and headless
  // Chromium runs one. Unknown renderers are assumed to be real hardware.
  const software = useThree((state) => {
    const context = state.gl.getContext();
    const info = context.getExtension("WEBGL_debug_renderer_info");
    const name = info ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    return /swiftshader|llvmpipe|software/i.test(name);
  });

  if (software) return null;

  return (
    <EffectComposer enableNormalPass multisampling={0}>
      <N8AO
        // Scaled to the room, so a broom cupboard and a hall get the same look.
        aoRadius={Math.min(Math.max(radius * 0.18, 0.35), 1.4)}
        distanceFalloff={0.8}
        intensity={2.6}
        quality="medium"
        halfRes
        color="#1a1410"
      />
      {/* The composer forces NoToneMapping on the renderer, so ACES has to be
          reapplied here or highlights clip. SMAA wants the LDR result, so it
          comes after. */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
    </EffectComposer>
  );
}

import { Vector2, Vector4, type Material, type WebGLProgramParametersWithUniforms } from "three";

export interface WeatherOptions {
  /**
   * Scale of the world-space break-up, in metres. A tiled texture repeating
   * every 2 m across a 6 m floor is obvious; a wash an order of magnitude
   * larger hides the repeat without reading as dirt.
   */
  detail?: number;
  /** Strength of the albedo and roughness variation, 0 to about 0.3. */
  weathering?: number;
  /** Half-extents of a box, in local units. Enables edge wear when set. */
  extents?: [number, number, number];
  /** Strength of the lightening along box edges. */
  wear?: number;
}

const NOISE = /* glsl */ `
  vec3 layraHash(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123) * 2.0 - 1.0;
  }

  float layraNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(dot(layraHash(i + vec3(0, 0, 0)), f - vec3(0, 0, 0)),
              dot(layraHash(i + vec3(1, 0, 0)), f - vec3(1, 0, 0)), u.x),
          mix(dot(layraHash(i + vec3(0, 1, 0)), f - vec3(0, 1, 0)),
              dot(layraHash(i + vec3(1, 1, 0)), f - vec3(1, 1, 0)), u.x), u.y),
      mix(mix(dot(layraHash(i + vec3(0, 0, 1)), f - vec3(0, 0, 1)),
              dot(layraHash(i + vec3(1, 0, 1)), f - vec3(1, 0, 1)), u.x),
          mix(dot(layraHash(i + vec3(0, 1, 1)), f - vec3(0, 1, 1)),
              dot(layraHash(i + vec3(1, 1, 1)), f - vec3(1, 1, 1)), u.x), u.y),
      u.z);
  }
`;

/**
 * Patches a standard material with two effects the texture itself cannot carry:
 * a world-space wash that hides the tile repeat and burnishes traffic lanes,
 * and a lightening along box edges where a real piece would be rubbed back.
 *
 * Sizes and strengths travel as uniforms rather than baked constants: three
 * caches compiled programs by cache key, and interpolating each slab's extents
 * into the source would mint a separate program per piece of furniture.
 */
export function weather(options: WeatherOptions) {
  const detail = options.detail ?? 9;
  const weathering = options.weathering ?? 0;
  const extents = options.extents;
  const wear = options.wear ?? 0;
  const wash = weathering > 0;
  const rub = Boolean(extents) && wear > 0;

  const onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uLayraWash = { value: new Vector2(Math.max(detail, 0.01), weathering) };
    shader.uniforms.uLayraWear = {
      value: new Vector4(
        Math.max(extents?.[0] ?? 1, 1e-4),
        Math.max(extents?.[1] ?? 1, 1e-4),
        Math.max(extents?.[2] ?? 1, 1e-4),
        wear,
      ),
    };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vLayraLocal;
        varying vec3 vLayraWorld;`,
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        vLayraLocal = position;
        vLayraWorld = (modelMatrix * vec4(position, 1.0)).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vLayraLocal;
        varying vec3 vLayraWorld;
        uniform vec2 uLayraWash;
        uniform vec4 uLayraWear;
        float layraRub;
        ${NOISE}`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        #ifdef LAYRA_WASH
          diffuseColor.rgb *= 1.0 + layraNoise(vLayraWorld / uLayraWash.x) * uLayraWash.y;
        #endif
        layraRub = 0.0;
        #ifdef LAYRA_WEAR
          vec3 layraEdge = abs(vLayraLocal) / uLayraWear.xyz;
          // Two axes near their limit means an edge or a corner, not a face.
          float layraHi = max(max(layraEdge.x, layraEdge.y), layraEdge.z);
          float layraLo = min(min(layraEdge.x, layraEdge.y), layraEdge.z);
          float laySecond = layraEdge.x + layraEdge.y + layraEdge.z - layraHi - layraLo;
          layraRub = smoothstep(0.74, 1.0, laySecond) * uLayraWear.w;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.3 + 0.025, layraRub);
        #endif`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        #ifdef LAYRA_WASH
          roughnessFactor *= 1.0 - layraNoise(vLayraWorld / (uLayraWash.x * 0.45)) * uLayraWash.y * 1.6;
        #endif
        #ifdef LAYRA_WEAR
          roughnessFactor *= 1.0 - layraRub * 0.45;
        #endif
        roughnessFactor = clamp(roughnessFactor, 0.02, 1.0);`,
      );

    const defines = `${wash ? "#define LAYRA_WASH\n" : ""}${rub ? "#define LAYRA_WEAR\n" : ""}`;
    shader.fragmentShader = defines + shader.fragmentShader;
  };

  // Only the feature combination varies the source, so at most a few programs.
  const key = `layra|${wash ? 1 : 0}|${rub ? 1 : 0}`;

  return { onBeforeCompile, customProgramCacheKey: () => key } satisfies Pick<
    Material,
    "onBeforeCompile" | "customProgramCacheKey"
  >;
}

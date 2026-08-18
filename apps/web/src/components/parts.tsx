"use client";

import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import { DoubleSide, Vector2, type Side } from "three";
import { Surface } from "./Surface";
import type { SurfaceKind } from "./textures";

export type Vec3Tuple = [number, number, number];

interface SlabProps {
  size: Vec3Tuple;
  position?: Vec3Tuple;
  rotation?: Vec3Tuple;
  kind?: SurfaceKind;
  color: string;
  roughness?: number;
  metalness?: number;
  /** Corner radius. Defaults to a small bevel scaled to the smallest edge. */
  radius?: number;
  relief?: number;
  scaleY?: number;
}

/**
 * The workhorse box. Every real edge is bevelled - a hard 90 degree corner is
 * the single strongest cue that something was modelled rather than built.
 */
export function Slab({
  size,
  position = [0, 0, 0],
  rotation,
  kind = "wood",
  color,
  roughness = 0.62,
  metalness = 0,
  radius,
  relief = 1,
  scaleY = 1,
}: SlabProps) {
  const smallest = Math.min(size[0], size[1], size[2]);
  const bevel = Math.max(0.002, Math.min(radius ?? smallest * 0.16, smallest * 0.49));
  const span = Math.max(size[0], size[1], size[2]);
  return (
    <RoundedBox
      args={size}
      position={position}
      rotation={rotation}
      scale={[1, scaleY, 1]}
      radius={bevel}
      smoothness={3}
      creaseAngle={0.5}
      castShadow
      receiveShadow
    >
      <Surface
        kind={kind}
        color={color}
        roughness={roughness}
        metalness={metalness}
        span={span}
        relief={relief}
      />
    </RoundedBox>
  );
}

interface CushionProps {
  size: Vec3Tuple;
  position?: Vec3Tuple;
  rotation?: Vec3Tuple;
  color: string;
  kind?: SurfaceKind;
  /** 0 keeps it slab-like, 1 pillows it right out. */
  plump?: number;
}

/** Upholstery: heavily rounded, slightly domed, and never quite square. */
export function Cushion({
  size,
  position = [0, 0, 0],
  rotation,
  color,
  kind = "fabric",
  plump = 0.6,
}: CushionProps) {
  const [w, h, d] = size;
  const radius = Math.min(h * (0.32 + plump * 0.16), w * 0.4, d * 0.4);
  return (
    <RoundedBox
      args={[w, h, d]}
      position={position}
      rotation={rotation}
      radius={radius}
      smoothness={4}
      creaseAngle={1.2}
      castShadow
      receiveShadow
    >
      <Surface
        kind={kind}
        color={color}
        roughness={kind === "leather" ? 0.55 : 0.92}
        span={Math.max(w, d)}
        relief={kind === "leather" ? 1.2 : 0.9}
      />
    </RoundedBox>
  );
}

interface LegProps {
  position: Vec3Tuple;
  height?: number;
  color?: string;
  kind?: SurfaceKind;
  /** Top and bottom radii. A taper is what separates furniture from scaffolding. */
  top?: number;
  bottom?: number;
  /** Outward tilt in radians, applied away from the piece's centre. */
  splay?: number;
  metalness?: number;
  roughness?: number;
}

export function Leg({
  position,
  height = 0.65,
  color = "#3f3028",
  kind = "darkWood",
  top = 0.032,
  bottom = 0.022,
  splay = 0,
  metalness = 0,
  roughness = 0.55,
}: LegProps) {
  const [x, y, z] = position;
  const tiltX = splay === 0 ? 0 : Math.sign(z) * -splay;
  const tiltZ = splay === 0 ? 0 : Math.sign(x) * splay;
  return (
    <mesh position={[x, y, z]} rotation={[tiltX, 0, tiltZ]} castShadow receiveShadow>
      <cylinderGeometry args={[top, bottom, height, 16, 1]} />
      <Surface
        kind={kind}
        color={color}
        roughness={roughness}
        metalness={metalness}
        span={height}
      />
    </mesh>
  );
}

/** Square-section leg for anything that reads as joinery rather than turned. */
export function PostLeg({
  position,
  height = 0.7,
  width = 0.055,
  color = "#3f3028",
  kind = "darkWood",
}: {
  position: Vec3Tuple;
  height?: number;
  width?: number;
  color?: string;
  kind?: SurfaceKind;
}) {
  return (
    <Slab
      size={[width, height, width]}
      position={position}
      kind={kind}
      color={color}
      radius={width * 0.18}
      roughness={0.58}
    />
  );
}

interface TubeProps {
  position: Vec3Tuple;
  rotation?: Vec3Tuple;
  length: number;
  radius?: number;
  color?: string;
  metalness?: number;
  roughness?: number;
  kind?: SurfaceKind;
}

export function Tube({
  position,
  rotation,
  length,
  radius = 0.016,
  color = "#b8bcc0",
  metalness = 0.85,
  roughness = 0.22,
  kind = "metal",
}: TubeProps) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, length, 14, 1]} />
      <Surface
        kind={kind}
        color={color}
        roughness={roughness}
        metalness={metalness}
        span={length}
        envMapIntensity={1.4}
      />
    </mesh>
  );
}

/** A bar pull standing off a door or drawer front on two posts. */
export function BarPull({
  position,
  length,
  color = "#c3c7cb",
  vertical = false,
  standoff = 0.035,
}: {
  position: Vec3Tuple;
  length: number;
  color?: string;
  vertical?: boolean;
  standoff?: number;
}) {
  const [x, y, z] = position;
  const half = length / 2 - 0.015;
  return (
    <group position={[x, y, z]}>
      <Tube
        position={[0, 0, -standoff]}
        rotation={vertical ? [0, 0, 0] : [0, 0, Math.PI / 2]}
        length={length}
        radius={0.011}
        color={color}
      />
      {[-1, 1].map((side) => (
        <Tube
          key={side}
          position={vertical ? [0, side * half, -standoff / 2] : [side * half, 0, -standoff / 2]}
          rotation={[Math.PI / 2, 0, 0]}
          length={standoff}
          radius={0.008}
          color={color}
        />
      ))}
    </group>
  );
}

export function Knob({
  position,
  radius = 0.022,
  color = "#c3c7cb",
}: {
  position: Vec3Tuple;
  radius?: number;
  color?: string;
}) {
  return (
    <group position={position}>
      <mesh castShadow>
        <sphereGeometry args={[radius, 14, 10]} />
        <Surface
          kind="metal"
          color={color}
          roughness={0.2}
          metalness={0.9}
          span={radius * 4}
          envMapIntensity={1.5}
        />
      </mesh>
      <Tube position={[0, 0, radius * 0.9]} rotation={[Math.PI / 2, 0, 0]} length={radius * 1.4} radius={radius * 0.35} color={color} />
    </group>
  );
}

interface DrawerProps {
  width: number;
  height: number;
  position: Vec3Tuple;
  color: string;
  kind?: SurfaceKind;
  pull?: "bar" | "knob" | "groove";
  pullColor?: string;
}

/** A drawer front proud of the carcass, with a shadow gap around it. */
export function DrawerFront({
  width,
  height,
  position,
  color,
  kind = "wood",
  pull = "bar",
  pullColor = "#c3c7cb",
}: DrawerProps) {
  const [x, y, z] = position;
  return (
    <group position={[x, y, z]}>
      <Slab
        size={[width, height, 0.022]}
        position={[0, 0, -0.011]}
        kind={kind}
        color={color}
        radius={0.008}
        roughness={0.55}
      />
      {pull === "bar" && <BarPull position={[0, 0, -0.024]} length={Math.min(width * 0.45, 0.28)} color={pullColor} />}
      {pull === "knob" && <Knob position={[0, 0, -0.03]} color={pullColor} />}
      {pull === "groove" && (
        <Slab
          size={[width * 0.5, 0.012, 0.014]}
          position={[0, height * 0.32, -0.026]}
          kind="metal"
          color={pullColor}
          radius={0.005}
          roughness={0.3}
          metalness={0.8}
        />
      )}
    </group>
  );
}

/**
 * A shaker door: the recessed centre panel sits behind four proud rails, so the
 * reveal casts a real shadow line instead of relying on a colour change.
 */
export function PanelDoor({
  width,
  height,
  position,
  color,
  frameColor,
  kind = "wood",
}: {
  width: number;
  height: number;
  position: Vec3Tuple;
  color: string;
  frameColor: string;
  kind?: SurfaceKind;
}) {
  const [x, y, z] = position;
  const rail = Math.min(width, height) * 0.16;
  return (
    <group position={[x, y, z]}>
      <Slab size={[width, height, 0.014]} position={[0, 0, -0.007]} kind={kind} color={color} radius={0.004} roughness={0.6} />
      {[-1, 1].map((side) => (
        <Slab
          key={`v${side}`}
          size={[rail, height, 0.018]}
          position={[side * (width - rail) / 2, 0, -0.023]}
          kind={kind}
          color={frameColor}
          radius={0.005}
          roughness={0.55}
        />
      ))}
      {[-1, 1].map((side) => (
        <Slab
          key={`h${side}`}
          size={[width - rail * 2, rail, 0.018]}
          position={[0, side * (height - rail) / 2, -0.023]}
          kind={kind}
          color={frameColor}
          radius={0.005}
          roughness={0.55}
        />
      ))}
    </group>
  );
}

/**
 * A basin: four inner walls and a floor dropped below a rim, since a hollow
 * cannot be subtracted from a box without CSG.
 */
export function Basin({
  width,
  depth,
  drop,
  position,
  color,
  kind = "ceramic",
  roughness = 0.16,
  metalness = 0,
  wall = 0.04,
}: {
  width: number;
  depth: number;
  drop: number;
  position: Vec3Tuple;
  color: string;
  kind?: SurfaceKind;
  roughness?: number;
  metalness?: number;
  wall?: number;
}) {
  const [x, y, z] = position;
  const common = { kind, color, roughness, metalness, radius: 0.012 } as const;
  return (
    <group position={[x, y, z]}>
      <Slab size={[width, wall, depth]} position={[0, -drop, 0]} {...common} />
      {[-1, 1].map((side) => (
        <Slab key={`x${side}`} size={[wall, drop, depth]} position={[side * (width - wall) / 2, -drop / 2, 0]} {...common} />
      ))}
      {[-1, 1].map((side) => (
        <Slab key={`z${side}`} size={[width - wall * 2, drop, wall]} position={[0, -drop / 2, side * (depth - wall) / 2]} {...common} />
      ))}
    </group>
  );
}

/** A frame of four bars around an opening - a rim, a surround, a mirror edge. */
export function Frame({
  width,
  height,
  bar,
  thickness,
  position,
  rotation,
  color,
  kind = "wood",
  roughness = 0.5,
  metalness = 0,
}: {
  width: number;
  height: number;
  bar: number;
  thickness: number;
  position: Vec3Tuple;
  rotation?: Vec3Tuple;
  color: string;
  kind?: SurfaceKind;
  roughness?: number;
  metalness?: number;
}) {
  const common = { kind, color, roughness, metalness, radius: bar * 0.28 } as const;
  return (
    <group position={position} rotation={rotation}>
      {[-1, 1].map((side) => (
        <Slab key={`x${side}`} size={[bar, height, thickness]} position={[side * (width - bar) / 2, 0, 0]} {...common} />
      ))}
      {[-1, 1].map((side) => (
        <Slab key={`y${side}`} size={[width - bar * 2, bar, thickness]} position={[0, side * (height - bar) / 2, 0]} {...common} />
      ))}
    </group>
  );
}

/**
 * A revolved profile - the only honest way to draw pots, shades, bowls and
 * turned bases. Points are (radius, height) pairs in metres.
 */
export function Lathe({
  profile,
  position = [0, 0, 0],
  rotation,
  color,
  kind = "ceramic",
  roughness = 0.5,
  metalness = 0,
  segments = 28,
  openEnded,
  emissive,
  emissiveIntensity,
  side,
}: {
  profile: Array<[number, number]>;
  position?: Vec3Tuple;
  rotation?: Vec3Tuple;
  color: string;
  kind?: SurfaceKind;
  roughness?: number;
  metalness?: number;
  segments?: number;
  openEnded?: boolean;
  emissive?: string;
  emissiveIntensity?: number;
  side?: Side;
}) {
  const points = useMemo(
    () => profile.map(([r, h]) => new Vector2(Math.max(r, 0.0001), h)),
    [profile],
  );
  const span = useMemo(
    () => Math.max(...profile.map(([, h]) => h)) - Math.min(...profile.map(([, h]) => h)),
    [profile],
  );
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <latheGeometry args={[points, segments]} />
      <Surface
        kind={kind}
        color={color}
        roughness={roughness}
        metalness={metalness}
        span={Math.max(span, 0.1)}
        side={side ?? (openEnded ? DoubleSide : undefined)}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

/**
 * Glazing. With an environment map present this reads as glass without
 * transmission. `emissive` stands in for whatever is outside: a window pane
 * with nothing modelled behind it otherwise reads as a black hole.
 */
export function Glass({
  size,
  position,
  rotation,
  color = "#cfe4ee",
  opacity = 0.22,
  emissive,
  emissiveIntensity = 0,
}: {
  size: Vec3Tuple;
  position: Vec3Tuple;
  rotation?: Vec3Tuple;
  color?: string;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow={false} receiveShadow={false}>
      <boxGeometry args={size} />
      <meshPhysicalMaterial
        color={color}
        transparent
        opacity={opacity}
        roughness={0.04}
        metalness={0}
        clearcoat={1}
        clearcoatRoughness={0.03}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        envMapIntensity={2.2}
        side={DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/** A mirror or screen: no transmission, just a very smooth reflective face. */
export function Reflective({
  size,
  position,
  rotation,
  color = "#aebfc9",
  roughness = 0.02,
  metalness = 1,
}: {
  size: Vec3Tuple;
  position: Vec3Tuple;
  rotation?: Vec3Tuple;
  color?: string;
  roughness?: number;
  metalness?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        envMapIntensity={2.6}
      />
    </mesh>
  );
}


"use client";

import { Surface } from "../Surface";
import { Frame, Glass, Slab, Tube, type Vec3Tuple } from "../parts";

// Local +Z is the room side: openingTransform aims each panel's normal along the
// wall's left normal, and the polygon is normalised to CCW.

export interface OpeningPanel {
  width: number;
  height: number;
  /** Wall thickness, which sets how deep the reveal and lining run. */
  thickness: number;
  open: boolean;
  curtainsOpen: boolean;
}

const FRAME = "#7a5b41";
const FRAME_LIT = "#38bdf8";
const LINING = "#c9bda9";
const LEAF = "#a87952";
const CURTAIN = "#c08473";
const CURTAIN_LIT = "#5eb7dd";
const BRASS = "#c9a24a";

/**
 * One curtain half, built as a zigzag of vertical folds. A flat slab is the
 * single most obvious tell that a curtain was faked.
 */
function Curtain({
  width,
  height,
  position,
  color,
  folds = 6,
}: {
  width: number;
  height: number;
  position: Vec3Tuple;
  color: string;
  folds?: number;
}) {
  const radius = width / (folds * 1.35);
  const step = width / folds;
  return (
    <group position={position}>
      {Array.from({ length: folds }, (_, i) => (
        <mesh
          key={i}
          position={[-width / 2 + step * (i + 0.5), 0, (i % 2 ? 1 : -1) * radius * 0.4]}
          castShadow
          receiveShadow
        >
          {/* Flared at the hem, the way hung fabric actually falls. */}
          <cylinderGeometry args={[radius, radius * 1.18, height, 10, 1]} />
          <Surface kind="fabric" color={color} roughness={0.95} span={height} relief={1.2} />
        </mesh>
      ))}
      <Slab
        size={[width + radius, 0.05, radius * 1.6]}
        position={[0, height / 2 - 0.02, 0]}
        kind="fabric"
        color={color}
        radius={0.012}
        roughness={0.9}
      />
    </group>
  );
}

/** Boards lining the cut through the wall, so the reveal is not raw wall. */
function Reveal({ width, height, thickness }: { width: number; height: number; thickness: number }) {
  const board = 0.014;
  return (
    <group>
      {[-1, 1].map((side) => (
        <Slab
          key={side}
          size={[board, height, thickness]}
          position={[side * (width - board) / 2, 0, 0]}
          kind="plaster"
          color={LINING}
          radius={0.003}
          roughness={0.85}
        />
      ))}
      <Slab
        size={[width - board * 2, board, thickness]}
        position={[0, (height - board) / 2, 0]}
        kind="plaster"
        color={LINING}
        radius={0.003}
        roughness={0.85}
      />
    </group>
  );
}

function Window({ panel, active }: { panel: OpeningPanel; active: boolean }) {
  const { width: w, height: h, thickness: t } = panel;
  const frame = active ? FRAME_LIT : FRAME;
  const curtain = active ? CURTAIN_LIT : CURTAIN;
  const inner = t / 2;
  // The sash sits toward the outer face, which is what gives a window its reveal.
  const sashZ = -t * 0.12;
  const member = 0.055;
  const bar = 0.026;
  const paneW = (w - member * 2 - bar) / 2;
  const paneH = (h - member * 2 - bar) / 2;

  const rodY = h / 2 + 0.13;
  const rodSpan = w + 0.34;
  const curtainH = h + 0.22;
  const curtainW = panel.curtainsOpen ? Math.max(w * 0.12, 0.11) : w / 2 + 0.06;
  const curtainX = panel.curtainsOpen ? w / 2 + 0.07 : w / 4 + 0.03;

  return (
    <group>
      <Reveal width={w} height={h} thickness={t} />

      <Slab size={[w + 0.1, 0.032, t + 0.055]} position={[0, -h / 2 + 0.016, 0.028]} kind="wood" color={LINING} radius={0.008} roughness={0.62} />
      <Slab size={[w + 0.13, 0.028, t * 0.45]} position={[0, -h / 2 - 0.012, -inner - 0.02]} rotation={[0.12, 0, 0]} kind="concrete" color="#b9b2a6" radius={0.006} roughness={0.9} />

      <Frame width={w} height={h} bar={member} thickness={0.075} position={[0, 0, sashZ]} color={frame} kind="wood" roughness={0.5} />
      <Frame width={w - member * 1.4} height={h - member * 1.4} bar={0.036} thickness={0.05} position={[0, 0, sashZ + 0.012]} color={frame} kind="wood" roughness={0.5} />

      <Slab size={[bar, h - member * 2, 0.042]} position={[0, 0, sashZ + 0.014]} kind="wood" color={frame} radius={0.006} roughness={0.5} />
      <Slab size={[w - member * 2, bar, 0.042]} position={[0, 0, sashZ + 0.014]} kind="wood" color={frame} radius={0.006} roughness={0.5} />

      {[-1, 1].flatMap((x) =>
        [-1, 1].map((y) => (
          <Glass
            key={`${x}${y}`}
            size={[paneW, paneH, 0.008]}
            position={[x * (paneW + bar) / 2, y * (paneH + bar) / 2, sashZ]}
            color="#d3e6f2"
            opacity={0.3}
            emissive="#cfe6f7"
            emissiveIntensity={0.45}
          />
        )),
      )}

      <Tube position={[w * 0.42, -h * 0.28, sashZ + 0.05]} rotation={[Math.PI / 2, 0, 0]} length={0.05} radius={0.011} color={BRASS} metalness={0.75} roughness={0.32} />
      <Tube position={[w * 0.42, -h * 0.22, sashZ + 0.075]} length={0.09} radius={0.009} color={BRASS} metalness={0.75} roughness={0.32} />

      <Tube position={[0, rodY, inner + 0.1]} rotation={[0, 0, Math.PI / 2]} length={rodSpan} radius={0.014} color="#8a6a4f" kind="wood" metalness={0.1} roughness={0.5} />
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * rodSpan / 2, rodY, inner + 0.1]} castShadow>
          <sphereGeometry args={[0.028, 12, 10]} />
          <Surface kind="wood" color="#8a6a4f" roughness={0.45} span={0.08} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <Curtain
          key={side}
          width={curtainW}
          height={curtainH}
          position={[side * curtainX, rodY - curtainH / 2 - 0.03, inner + 0.1]}
          color={curtain}
          folds={panel.curtainsOpen ? 4 : 7}
        />
      ))}
    </group>
  );
}

function Door({ panel, active }: { panel: OpeningPanel; active: boolean }) {
  const { width: w, height: h, thickness: t } = panel;
  const frame = active ? FRAME_LIT : FRAME;
  const lining = 0.026;
  const leafW = Math.max(w - lining * 2 - 0.012, 0.1);
  const leafH = Math.max(h - lining - 0.014, 0.1);
  const leafT = 0.042;
  const stile = Math.min(leafW * 0.17, 0.13);
  const rail = Math.min(leafH * 0.1, 0.16);
  const panelW = leafW - stile * 2;

  return (
    <group>
      {[-1, 1].map((side) => (
        <Slab key={side} size={[lining, h, t]} position={[side * (w - lining) / 2, 0, 0]} kind="wood" color={frame} radius={0.005} roughness={0.5} />
      ))}
      <Slab size={[w - lining * 2, lining, t]} position={[0, (h - lining) / 2, 0]} kind="wood" color={frame} radius={0.005} roughness={0.5} />
      <Slab size={[w - lining * 2, 0.02, t + 0.01]} position={[0, -h / 2 + 0.01, 0]} kind="darkWood" color="#6a5140" radius={0.004} roughness={0.6} />

      <Frame width={w + 0.13} height={h + 0.07} bar={0.075} thickness={0.02} position={[0, 0.035, t / 2 + 0.01]} color={frame} kind="wood" roughness={0.55} />

      <group position={[-w / 2 + lining, 0, 0]} rotation={[0, panel.open ? -Math.PI / 2 : 0, 0]}>
        <group position={[leafW / 2 + 0.006, -0.007, 0.01]}>
          <Slab size={[leafW, leafH, leafT]} kind="wood" color={LEAF} radius={0.006} roughness={0.52} />
          {/* Stiles and rails proud on both faces: that relief is the panelling. */}
          {[-1, 1].flatMap((face) => [
            ...[-1, 1].map((x) => (
              <Slab
                key={`s${face}${x}`}
                size={[stile, leafH, 0.016]}
                position={[x * (leafW - stile) / 2, 0, face * (leafT / 2 + 0.007)]}
                kind="wood"
                color={LEAF}
                radius={0.004}
                roughness={0.52}
              />
            )),
            ...[-1, 0, 1].map((y) => (
              <Slab
                key={`r${face}${y}`}
                size={[panelW, y === 0 ? rail * 1.3 : rail, 0.016]}
                position={[0, y * (leafH - rail) / 2, face * (leafT / 2 + 0.007)]}
                kind="wood"
                color={LEAF}
                radius={0.004}
                roughness={0.52}
              />
            )),
          ])}
          {[-1, 1].map((face) => (
            <group key={`h${face}`} position={[leafW / 2 - 0.09, 0, face * (leafT / 2 + 0.012)]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.031, 0.031, 0.014, 16]} />
                <Surface kind="metal" color={BRASS} roughness={0.28} metalness={0.8} span={0.08} envMapIntensity={1.5} />
              </mesh>
              <Tube position={[0, 0, face * 0.026]} rotation={[Math.PI / 2, 0, 0]} length={0.045} radius={0.011} color={BRASS} metalness={0.8} roughness={0.28} />
              <Tube position={[-0.045, 0, face * 0.046]} rotation={[0, 0, Math.PI / 2]} length={0.1} radius={0.011} color={BRASS} metalness={0.8} roughness={0.28} />
            </group>
          ))}
          {[-0.32, 0.32].map((y) => (
            <mesh key={y} position={[-leafW / 2 - 0.004, y * leafH, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.012, 0.012, 0.09, 10]} />
              <Surface kind="metal" color={BRASS} roughness={0.34} metalness={0.7} span={0.1} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

export function OpeningModel({
  type,
  panel,
  active,
}: {
  type: "door" | "window";
  panel: OpeningPanel;
  active: boolean;
}) {
  return type === "door" ? <Door panel={panel} active={active} /> : <Window panel={panel} active={active} />;
}

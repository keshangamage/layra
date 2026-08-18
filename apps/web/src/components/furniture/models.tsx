"use client";

import { DoubleSide } from "three";
import type { CatalogItem, FurnitureFinish } from "@layra/types";
import { Surface } from "../Surface";
import {
  BarPull,
  Basin,
  Cushion,
  DrawerFront,
  Frame,
  Glass,
  Lathe,
  Leg,
  PanelDoor,
  PostLeg,
  Reflective,
  Slab,
  Tube,
} from "../parts";
import { paletteFor, upholsteryKind } from "./palette";

// Every piece faces -Z. Placement rotation turns the whole group from there.

const BOOK_COLOURS = ["#8f4436", "#4c5f45", "#33506b", "#a9803f", "#6a4a6e", "#3f4a55"];

export function FurnitureModel({
  item,
  finish,
}: {
  item: CatalogItem;
  finish?: FurnitureFinish;
}) {
  const { w, d } = item.footprint;
  const h = item.height;
  const p = paletteFor(finish);
  const cloth = upholsteryKind(finish);

  switch (item.id) {
    case "sofa-3": {
      const armW = 0.21;
      const seatY = 0.42;
      const inner = w - armW * 2;
      const bay = inner / 3;
      return (
        <group>
          <Slab size={[w - 0.06, 0.2, d - 0.06]} position={[0, 0.28, 0]} kind={cloth} color={p.fabric} radius={0.05} roughness={0.9} />
          {[-1, 0, 1].map((i) => (
            <Cushion
              key={`seat${i}`}
              size={[bay - 0.035, 0.16, d * 0.66]}
              position={[i * bay, seatY, -d * 0.08]}
              color={p.cushion}
              kind={cloth}
              plump={0.9}
            />
          ))}
          {[-1, 0, 1].map((i) => (
            <Cushion
              key={`back${i}`}
              size={[bay - 0.035, 0.44, 0.19]}
              position={[i * bay, 0.66, d * 0.29]}
              rotation={[0.14, 0, 0]}
              color={p.fabric}
              kind={cloth}
              plump={0.75}
            />
          ))}
          {[-1, 1].map((side) => (
            <group key={`arm${side}`}>
              <Cushion
                size={[armW, 0.34, d - 0.06]}
                position={[side * (w - armW) / 2, 0.45, 0]}
                color={p.fabric}
                kind={cloth}
                plump={0.35}
              />
              <mesh
                position={[side * (w - armW) / 2, 0.62, 0]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
                receiveShadow
              >
                <capsuleGeometry args={[armW / 2, d - 0.06 - armW, 6, 18]} />
                <Surface kind={cloth} color={p.fabric} roughness={0.9} span={d} />
              </mesh>
            </group>
          ))}
          <Cushion size={[0.4, 0.13, 0.38]} position={[-w * 0.29, 0.63, d * 0.19]} rotation={[0.95, 0.25, 0.18]} color={p.accent} kind={cloth} plump={0.35} />
          <Cushion size={[0.36, 0.12, 0.34]} position={[w * 0.3, 0.62, d * 0.21]} rotation={[1.05, -0.3, -0.14]} color={p.cushion} kind={cloth} plump={0.35} />
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <Leg
                key={`${x}${z}`}
                position={[x * (w / 2 - 0.16), 0.09, z * (d / 2 - 0.13)]}
                height={0.19}
                top={0.03}
                bottom={0.018}
                splay={0.09}
                color={p.darkWood}
              />
            )),
          )}
        </group>
      );
    }

    case "armchair": {
      const armW = 0.17;
      return (
        <group>
          <Slab size={[w - 0.05, 0.2, d - 0.05]} position={[0, 0.28, 0]} kind={cloth} color={p.fabric} radius={0.05} roughness={0.9} />
          <Cushion size={[w - armW * 2 - 0.04, 0.16, d * 0.64]} position={[0, 0.42, -d * 0.07]} color={p.cushion} kind={cloth} plump={0.95} />
          <Cushion size={[w - armW * 2 - 0.02, 0.44, 0.18]} position={[0, 0.66, d * 0.29]} rotation={[0.15, 0, 0]} color={p.fabric} kind={cloth} plump={0.8} />
          {[-1, 1].map((side) => (
            <group key={side}>
              <Cushion size={[armW, 0.32, d - 0.05]} position={[side * (w - armW) / 2, 0.44, 0]} color={p.fabric} kind={cloth} plump={0.35} />
              <mesh position={[side * (w - armW) / 2, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <capsuleGeometry args={[armW / 2, d - 0.05 - armW, 6, 16]} />
                <Surface kind={cloth} color={p.fabric} roughness={0.9} span={d} />
              </mesh>
            </group>
          ))}
          <Cushion size={[0.34, 0.12, 0.32]} position={[-w * 0.13, 0.62, d * 0.2]} rotation={[1, 0.35, 0.2]} color={p.accent} kind={cloth} plump={0.35} />
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <Leg key={`${x}${z}`} position={[x * (w / 2 - 0.13), 0.09, z * (d / 2 - 0.13)]} height={0.19} top={0.028} bottom={0.017} splay={0.1} color={p.darkWood} />
            )),
          )}
        </group>
      );
    }

    case "bed-double": {
      const head = d / 2;
      const mattressY = 0.34;
      return (
        <group>
          <Slab size={[w, 0.16, d]} position={[0, 0.22, 0]} kind="darkWood" color={p.darkWood} radius={0.02} roughness={0.55} />
          <Slab size={[w - 0.08, 0.24, d - 0.1]} position={[0, mattressY, 0]} kind="fabric" color="#efe8dc" radius={0.055} roughness={0.9} relief={0.7} />
          <Slab size={[w - 0.05, 0.11, d * 0.6]} position={[0, 0.49, -d * 0.19]} kind="fabric" color={p.cushion} radius={0.05} roughness={0.95} />
          <Slab size={[w - 0.05, 0.075, 0.16]} position={[0, 0.53, d * 0.11]} rotation={[-0.12, 0, 0]} kind="fabric" color="#f4efe6" radius={0.035} roughness={0.95} />
          {[-1, 1].map((side) => (
            <Cushion
              key={side}
              size={[w * 0.42, 0.13, d * 0.19]}
              position={[side * w * 0.22, 0.53, head - 0.33]}
              rotation={[-0.16, side * 0.04, 0]}
              color="#f7f2e9"
              plump={1}
            />
          ))}
          <Slab size={[w + 0.06, 0.95, 0.09]} position={[0, 0.56, head - 0.045]} kind="darkWood" color={p.darkWood} radius={0.02} roughness={0.5} />
          <Cushion size={[w - 0.1, 0.6, 0.07]} position={[0, 0.6, head - 0.11]} color={p.fabric} kind={cloth} plump={0.5} />
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <PostLeg key={`${x}${z}`} position={[x * (w / 2 - 0.07), 0.07, z * (d / 2 - 0.07)]} height={0.14} width={0.07} color={p.darkWood} />
            )),
          )}
        </group>
      );
    }

    case "dining-table": {
      const topY = h - 0.02;
      return (
        <group>
          <Slab size={[w, 0.04, d]} position={[0, topY, 0]} kind="wood" color={p.wood} radius={0.012} roughness={0.35} />
          <Slab size={[w - 0.03, 0.03, d - 0.03]} position={[0, topY - 0.035, 0]} kind="wood" color={p.wood} radius={0.008} roughness={0.4} />
          {[-1, 1].map((z) => (
            <Slab key={`rail${z}`} size={[w - 0.28, 0.09, 0.035]} position={[0, topY - 0.11, z * (d / 2 - 0.09)]} kind="darkWood" color={p.darkWood} radius={0.008} />
          ))}
          {[-1, 1].map((x) => (
            <Slab key={`side${x}`} size={[0.035, 0.09, d - 0.28]} position={[x * (w / 2 - 0.09), topY - 0.11, 0]} kind="darkWood" color={p.darkWood} radius={0.008} />
          ))}
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <Leg key={`${x}${z}`} position={[x * (w / 2 - 0.09), (h - 0.06) / 2, z * (d / 2 - 0.09)]} height={h - 0.06} top={0.036} bottom={0.022} color={p.darkWood} />
            )),
          )}
          <Lathe
            profile={[[0, 0], [0.11, 0], [0.13, 0.03], [0.14, 0.07], [0.128, 0.072], [0.115, 0.032], [0.095, 0.008]]}
            position={[0, h, 0]}
            color={p.stone}
            kind="ceramic"
            roughness={0.3}
          />
        </group>
      );
    }

    case "dining-chair": {
      const seatY = 0.45;
      const backTop = h - 0.02;
      return (
        <group>
          <Slab size={[w, 0.045, d]} position={[0, seatY, 0]} kind="wood" color={p.wood} radius={0.014} roughness={0.42} />
          <Cushion size={[w - 0.05, 0.055, d - 0.05]} position={[0, seatY + 0.045, -0.005]} color={p.cushion} kind={cloth} plump={0.5} />
          {[-1, 1].map((x) => (
            <Slab
              key={x}
              size={[0.036, backTop - seatY, 0.036]}
              position={[x * (w / 2 - 0.03), (seatY + backTop) / 2, d / 2 - 0.04]}
              rotation={[-0.07, 0, 0]}
              kind="wood"
              color={p.wood}
              radius={0.008}
            />
          ))}
          {[0.62, 0.74, 0.86].map((t) => (
            <Slab
              key={t}
              size={[w - 0.05, 0.055, 0.022]}
              position={[0, t * backTop + 0.06, d / 2 - 0.04 - (t - 0.62) * 0.09]}
              rotation={[-0.07, 0, 0]}
              kind="wood"
              color={p.wood}
              radius={0.008}
            />
          ))}
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <Leg key={`${x}${z}`} position={[x * (w / 2 - 0.045), seatY / 2, z * (d / 2 - 0.045)]} height={seatY} top={0.024} bottom={0.015} splay={0.06} color={p.darkWood} />
            )),
          )}
          <Slab size={[w - 0.09, 0.02, 0.02]} position={[0, 0.16, 0]} kind="darkWood" color={p.darkWood} radius={0.006} />
        </group>
      );
    }

    case "desk": {
      const topY = h - 0.02;
      const ped = { w: w * 0.3, h: h - 0.16, d: d - 0.08 };
      return (
        <group>
          <Slab size={[w, 0.038, d]} position={[0, topY, 0]} kind="wood" color={p.wood} radius={0.01} roughness={0.34} />
          <Slab size={[w - 0.04, 0.028, d - 0.04]} position={[0, topY - 0.032, 0]} kind="wood" color={p.wood} radius={0.008} roughness={0.4} />
          <Slab size={[ped.w, ped.h, ped.d]} position={[-w / 2 + ped.w / 2 + 0.03, ped.h / 2 + 0.06, 0]} kind="wood" color={p.wood} radius={0.01} roughness={0.5} />
          {[0.26, 0.46, 0.66].map((t) => (
            <DrawerFront
              key={t}
              width={ped.w - 0.04}
              height={ped.h * 0.28}
              position={[-w / 2 + ped.w / 2 + 0.03, 0.06 + ped.h * t, -ped.d / 2]}
              color={p.wood}
              pullColor={p.metal}
            />
          ))}
          {[-1, 1].map((z) => (
            <Slab key={z} size={[0.05, h - 0.1, 0.05]} position={[w / 2 - 0.09, (h - 0.1) / 2, z * (d / 2 - 0.08)]} kind="metal" color={p.metal} radius={0.01} roughness={0.35} metalness={0.6} />
          ))}
          <Slab size={[0.05, 0.05, d - 0.16]} position={[w / 2 - 0.09, 0.03, 0]} kind="metal" color={p.metal} radius={0.012} roughness={0.35} metalness={0.6} />
          <Slab size={[w * 0.3, 0.018, d * 0.4]} position={[w * 0.06, h + 0.012, -d * 0.14]} kind="metal" color="#2a2f36" radius={0.006} roughness={0.6} metalness={0.3} />
          <mesh position={[w * 0.27, h + 0.02, -d * 0.12]} castShadow>
            <capsuleGeometry args={[0.032, 0.03, 4, 14]} />
            <Surface kind="metal" color="#31383f" roughness={0.5} metalness={0.2} span={0.1} />
          </mesh>
          <Slab size={[0.22, 0.014, 0.16]} position={[w * 0.06, h + 0.007, d * 0.2]} kind="metal" color="#1e2429" radius={0.006} roughness={0.55} />
          <Tube position={[w * 0.06, h + 0.07, d * 0.22]} length={0.12} radius={0.014} color="#4a5560" />
          <Slab size={[w * 0.42, w * 0.24, 0.014]} position={[w * 0.06, h + 0.24, d * 0.22]} rotation={[-0.08, 0, 0]} kind="metal" color="#20262c" radius={0.006} roughness={0.4} metalness={0.4} />
          <Reflective size={[w * 0.4, w * 0.22, 0.004]} position={[w * 0.06, h + 0.24, d * 0.22 - 0.011]} rotation={[-0.08, 0, 0]} color="#1b2c38" roughness={0.12} metalness={0.75} />
          <Lathe
            profile={[[0.038, 0], [0.04, 0.005], [0.038, 0.09], [0.034, 0.095], [0.034, 0.008], [0, 0.006]]}
            position={[-w * 0.06, h + 0.02, -d * 0.22]}
            color={p.shell}
            kind="ceramic"
            roughness={0.28}
          />
        </group>
      );
    }

    case "wardrobe": {
      const plinth = 0.09;
      const body = h - plinth - 0.05;
      return (
        <group>
          <Slab size={[w - 0.06, plinth, d - 0.06]} position={[0, plinth / 2, 0]} kind="darkWood" color={p.darkWood} radius={0.006} />
          <Slab size={[w, body, d]} position={[0, plinth + body / 2, 0]} kind="wood" color={p.wood} radius={0.01} roughness={0.5} />
          <Slab size={[w + 0.05, 0.05, d + 0.04]} position={[0, h - 0.025, 0]} kind="wood" color={p.wood} radius={0.012} roughness={0.45} />
          {[-1, 1].map((side) => (
            <PanelDoor
              key={side}
              width={w / 2 - 0.02}
              height={body - 0.04}
              position={[side * w * 0.25, plinth + body / 2, -d / 2]}
              color={p.wood}
              frameColor={p.wood}
            />
          ))}
          {[-1, 1].map((side) => (
            <BarPull key={side} position={[side * 0.08, plinth + body * 0.5, -d / 2 - 0.032]} length={body * 0.24} vertical color={p.metal} />
          ))}
        </group>
      );
    }

    case "bookshelf": {
      const side = 0.028;
      const shelves = [0.36, 0.72, 1.08, 1.44].filter((y) => y < h - 0.12);
      return (
        <group>
          <Slab size={[w - 0.05, 0.08, d - 0.04]} position={[0, 0.04, 0.01]} kind="darkWood" color={p.darkWood} radius={0.006} />
          {[-1, 1].map((x) => (
            <Slab key={x} size={[side, h - 0.08, d]} position={[x * (w - side) / 2, 0.08 + (h - 0.08) / 2, 0]} kind="wood" color={p.wood} radius={0.005} roughness={0.5} />
          ))}
          <Slab size={[w, 0.03, 0.012]} position={[0, h - 0.015, d / 2 - 0.006]} kind="wood" color={p.wood} radius={0.004} />
          <Slab size={[w - side * 2, h - 0.11, 0.01]} position={[0, 0.08 + (h - 0.08) / 2, d / 2 - 0.005]} kind="wood" color={p.darkWood} radius={0.003} roughness={0.7} />
          {shelves.map((y) => (
            <Slab key={y} size={[w - side * 2, 0.024, d - 0.02]} position={[0, y, -0.005]} kind="wood" color={p.wood} radius={0.005} roughness={0.5} />
          ))}
          {shelves.map((y, row) =>
            [0, 1, 2, 3, 4].map((i) => {
              const lean = row % 2 === 1 && i === 4;
              const tall = 0.2 + ((i + row) % 3) * 0.035;
              const thick = 0.032 + ((i * 7 + row) % 3) * 0.014;
              return (
                <Slab
                  key={`${y}-${i}`}
                  size={[thick, tall, d - 0.09]}
                  position={[-w / 2 + 0.06 + i * 0.052 + (lean ? 0.03 : 0), y + tall / 2 + 0.012, -0.02]}
                  rotation={lean ? [0, 0, 0.28] : undefined}
                  kind="paper"
                  color={BOOK_COLOURS[(i + row * 2) % BOOK_COLOURS.length]!}
                  radius={0.004}
                  roughness={0.82}
                />
              );
            }),
          )}
          {shelves.slice(1).map((y) => (
            <group key={`stack${y}`}>
              <Slab size={[0.15, 0.028, d - 0.09]} position={[w / 2 - 0.12, y + 0.026, -0.02]} kind="paper" color="#8b8377" radius={0.004} roughness={0.85} />
              <Slab size={[0.14, 0.026, d - 0.1]} position={[w / 2 - 0.125, y + 0.054, -0.018]} kind="paper" color="#6f7b6a" radius={0.004} roughness={0.85} />
            </group>
          ))}
        </group>
      );
    }

    case "wall-shelf":
      return (
        <group>
          <Slab size={[w, 0.035, d]} position={[0, h * 0.5, 0]} kind="wood" color={p.wood} radius={0.012} roughness={0.42} />
          {[-1, 1].map((x) => (
            <group key={x}>
              <Slab size={[0.016, 0.14, 0.026]} position={[x * w * 0.34, h * 0.5 - 0.09, d / 2 - 0.02]} kind="metal" color={p.metal} radius={0.004} roughness={0.35} metalness={0.65} />
              <Slab size={[0.016, 0.026, d * 0.6]} position={[x * w * 0.34, h * 0.5 - 0.03, d * 0.1]} kind="metal" color={p.metal} radius={0.004} roughness={0.35} metalness={0.65} />
            </group>
          ))}
          {[0, 1, 2].map((i) => (
            <Slab
              key={i}
              size={[0.036, 0.19 + i * 0.02, d - 0.07]}
              position={[-w * 0.3 + i * 0.045, h * 0.5 + 0.113 + i * 0.01, 0]}
              kind="paper"
              color={BOOK_COLOURS[i]!}
              radius={0.004}
              roughness={0.82}
            />
          ))}
          <Lathe
            profile={[[0, 0], [0.05, 0.005], [0.055, 0.04], [0.038, 0.09], [0.042, 0.11], [0.036, 0.112], [0.032, 0.088], [0.048, 0.04], [0.044, 0.008], [0, 0.004]]}
            position={[w * 0.25, h * 0.518, 0]}
            color={p.accent}
            kind="ceramic"
            roughness={0.32}
          />
        </group>
      );

    case "coffee-table": {
      const topY = h - 0.02;
      return (
        <group>
          <Slab size={[w, 0.036, d]} position={[0, topY, 0]} kind="wood" color={p.wood} radius={0.014} roughness={0.34} />
          <Slab size={[w - 0.04, 0.024, d - 0.04]} position={[0, topY - 0.03, 0]} kind="wood" color={p.wood} radius={0.008} roughness={0.42} />
          {[0, 1, 2, 3].map((i) => (
            <Slab
              key={i}
              size={[w - 0.24, 0.016, (d - 0.24) / 5]}
              position={[0, h * 0.32, -(d - 0.24) / 2 + ((d - 0.24) / 4) * i + (d - 0.24) / 10]}
              kind="wood"
              color={p.darkWood}
              radius={0.005}
            />
          ))}
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <Leg key={`${x}${z}`} position={[x * (w / 2 - 0.1), (h - 0.05) / 2, z * (d / 2 - 0.1)]} height={h - 0.05} top={0.03} bottom={0.018} splay={0.11} color={p.darkWood} />
            )),
          )}
          <Slab size={[0.2, 0.024, 0.26]} position={[-w * 0.2, topY + 0.032, 0.02]} kind="paper" color={BOOK_COLOURS[2]!} radius={0.004} roughness={0.8} />
          <Slab size={[0.19, 0.02, 0.25]} position={[-w * 0.19, topY + 0.054, 0.03]} kind="paper" color={BOOK_COLOURS[4]!} radius={0.004} roughness={0.8} />
          <Lathe
            profile={[[0, 0], [0.09, 0], [0.105, 0.025], [0.11, 0.055], [0.1, 0.057], [0.093, 0.028], [0.078, 0.006]]}
            position={[w * 0.22, topY + 0.018, 0]}
            color={p.stone}
            kind="ceramic"
            roughness={0.26}
          />
        </group>
      );
    }

    case "tv-stand": {
      const bodyH = h - 0.09;
      return (
        <group>
          <Slab size={[w - 0.1, 0.09, d - 0.06]} position={[0, 0.045, 0.01]} kind="darkWood" color={p.darkWood} radius={0.006} />
          <Slab size={[w, bodyH, d]} position={[0, 0.09 + bodyH / 2, 0]} kind="wood" color={p.wood} radius={0.01} roughness={0.48} />
          <Slab size={[w + 0.04, 0.032, d + 0.03]} position={[0, h - 0.016, 0]} kind="wood" color={p.wood} radius={0.01} roughness={0.38} />
          {[-1, 1].map((side) => (
            <DrawerFront
              key={side}
              width={w * 0.32}
              height={bodyH - 0.06}
              position={[side * w * 0.32, 0.09 + bodyH / 2, -d / 2]}
              color={p.wood}
              pull="groove"
              pullColor={p.metal}
            />
          ))}
          <Slab size={[w * 0.3, bodyH - 0.06, 0.014]} position={[0, 0.09 + bodyH / 2, -d / 2 + 0.03]} kind="wood" color={p.darkWood} radius={0.004} roughness={0.7} />
          <Slab size={[w * 0.26, 0.018, d - 0.1]} position={[0, 0.09 + bodyH * 0.42, 0]} kind="wood" color={p.darkWood} radius={0.004} />
          <Slab size={[0.34, 0.016, 0.14]} position={[0, h + 0.008, 0]} kind="metal" color="#22262b" radius={0.005} roughness={0.5} metalness={0.5} />
          <Tube position={[0, h + 0.1, 0]} length={0.18} radius={0.018} color="#2b3138" metalness={0.6} roughness={0.4} />
          <Slab size={[w * 0.78, w * 0.44, 0.016]} position={[0, h + 0.42, 0]} kind="metal" color="#191d21" radius={0.006} roughness={0.42} metalness={0.4} />
          <Reflective size={[w * 0.75, w * 0.41, 0.004]} position={[0, h + 0.42, -0.012]} color="#16232c" roughness={0.1} metalness={0.8} />
        </group>
      );
    }

    case "floor-lamp": {
      const shade = 0.26;
      return (
        <group>
          <Lathe
            profile={[[0, 0], [0.16, 0], [0.165, 0.012], [0.155, 0.028], [0.03, 0.034], [0.026, 0.04]]}
            color={p.metal}
            kind="metal"
            roughness={0.28}
            metalness={0.8}
          />
          <Tube position={[0, (h - shade) / 2 + 0.03, 0]} length={h - shade - 0.02} radius={0.014} color={p.metal} metalness={0.85} roughness={0.22} />
          <Lathe
            profile={[[0.13, 0], [0.185, shade]]}
            position={[0, h - shade, 0]}
            color="#f0e2c8"
            kind="paper"
            roughness={0.85}
            side={DoubleSide}
            emissive="#ffd9a0"
            emissiveIntensity={0.55}
          />
          <mesh position={[0, h - shade * 0.45, 0]}>
            <sphereGeometry args={[0.05, 12, 10]} />
            <meshStandardMaterial color="#fff4dd" emissive="#ffe0b0" emissiveIntensity={2.4} roughness={0.4} />
          </mesh>
          <pointLight position={[0, h - shade * 0.5, 0]} intensity={0.35} distance={3.2} decay={2} color="#ffd9a8" />
        </group>
      );
    }

    case "plant": {
      const potH = 0.3;
      const canopy = Array.from({ length: 15 }, (_, i) => {
        const angle = i * 2.399;
        const t = i / 14;
        return {
          angle,
          reach: 0.16 + t * 0.16,
          y: potH + 0.18 + t * (h - potH - 0.3),
          droop: 0.5 - t * 0.75,
          scale: 1 - t * 0.35,
        };
      });
      return (
        <group>
          <Lathe
            profile={[[0, 0], [0.13, 0], [0.15, 0.03], [0.18, potH - 0.03], [0.19, potH], [0.175, potH], [0.155, potH - 0.04], [0.128, 0.03], [0.11, 0.015]]}
            color="#a8613f"
            kind="ceramic"
            roughness={0.72}
          />
          <mesh position={[0, potH - 0.03, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.155, 0.155, 0.02, 24]} />
            <Surface kind="concrete" color="#3b2f27" roughness={1} span={0.3} />
          </mesh>
          {canopy.map(({ angle, reach, y, droop, scale }, i) => (
            <group key={i} rotation={[0, angle, 0]}>
              <mesh
                position={[reach * 0.4, (potH + y) / 2 + 0.04, 0]}
                rotation={[0, 0, -0.5]}
                castShadow
              >
                <cylinderGeometry args={[0.005, 0.009, y - potH + 0.14, 6]} />
                <Surface kind="foliage" color="#47663e" roughness={0.9} span={0.4} />
              </mesh>
              <mesh
                position={[reach, y, 0]}
                rotation={[0.18, 0, -0.9 + droop]}
                scale={[0.19 * scale, 0.014, 0.085 * scale]}
                castShadow
              >
                <sphereGeometry args={[1, 14, 10]} />
                <Surface
                  kind="foliage"
                  color={i % 3 === 0 ? "#6b9a5e" : i % 3 === 1 ? "#4f7f4a" : "#3f6b41"}
                  roughness={0.85}
                  span={0.25}
                  relief={1.4}
                />
              </mesh>
            </group>
          ))}
        </group>
      );
    }

    case "rug": {
      const pile = 0.016;
      const fringe = 22;
      return (
        <group>
          <Slab size={[w, pile, d]} position={[0, pile / 2, 0]} kind="carpet" color={p.fabric} radius={0.006} roughness={1} relief={1.5} />
          <Slab size={[w - 0.16, 0.004, d - 0.16]} position={[0, pile + 0.001, 0]} kind="carpet" color={p.accent} radius={0.002} roughness={1} relief={1.2} />
          <Slab size={[w - 0.26, 0.004, d - 0.26]} position={[0, pile + 0.003, 0]} kind="carpet" color={p.cushion} radius={0.002} roughness={1} relief={1.2} />
          {[-1, 1].flatMap((side) =>
            Array.from({ length: fringe }, (_, i) => (
              <mesh
                key={`${side}-${i}`}
                position={[-w / 2 + 0.03 + (i * (w - 0.06)) / (fringe - 1), pile * 0.4, side * (d / 2 + 0.022)]}
                rotation={[Math.PI / 2, 0, ((i % 3) - 1) * 0.12]}
                castShadow={false}
              >
                <cylinderGeometry args={[0.0035, 0.0025, 0.05, 5]} />
                <Surface kind="carpet" color={p.accent} roughness={1} span={0.1} />
              </mesh>
            )),
          )}
        </group>
      );
    }

    case "kitchen-island": {
      const toe = 0.1;
      const body = h - toe - 0.05;
      return (
        <group>
          <Slab size={[w - 0.12, toe, d - 0.1]} position={[0, toe / 2, 0.01]} kind="metal" color="#4b4f54" radius={0.004} roughness={0.6} />
          <Slab size={[w, body, d]} position={[0, toe + body / 2, 0]} kind="wood" color={p.shell} radius={0.008} roughness={0.55} />
          <Slab size={[w + 0.09, 0.05, d + 0.07]} position={[0, h - 0.025, -0.01]} kind="marble" color={p.stone} radius={0.014} roughness={0.18} relief={0.5} />
          {[-1, 0, 1].map((i) => (
            <DrawerFront
              key={i}
              width={w / 3 - 0.03}
              height={body * 0.28}
              position={[i * (w / 3), toe + body * 0.82, -d / 2]}
              color={p.shell}
              pullColor={p.metal}
            />
          ))}
          {[-1, 0, 1].map((i) => (
            <PanelDoor
              key={i}
              width={w / 3 - 0.03}
              height={body * 0.6}
              position={[i * (w / 3), toe + body * 0.33, -d / 2]}
              color={p.shell}
              frameColor={p.shell}
            />
          ))}
          {[-1, 0, 1].map((i) => (
            <BarPull key={i} position={[i * (w / 3) + w * 0.09, toe + body * 0.58, -d / 2 - 0.028]} length={0.16} vertical color={p.metal} />
          ))}
          <Lathe
            profile={[[0, 0], [0.13, 0], [0.145, 0.03], [0.15, 0.08], [0.138, 0.082], [0.128, 0.034], [0.11, 0.008]]}
            position={[w * 0.28, h, 0]}
            color={p.accent}
            kind="ceramic"
            roughness={0.3}
          />
        </group>
      );
    }

    case "nightstand": {
      const legH = 0.13;
      const body = h - legH - 0.03;
      return (
        <group>
          <Slab size={[w, body, d]} position={[0, legH + body / 2, 0]} kind="wood" color={p.wood} radius={0.008} roughness={0.5} />
          <Slab size={[w + 0.03, 0.03, d + 0.03]} position={[0, h - 0.015, 0]} kind="wood" color={p.wood} radius={0.008} roughness={0.4} />
          {[0.3, 0.7].map((t) => (
            <DrawerFront
              key={t}
              width={w - 0.05}
              height={body * 0.4}
              position={[0, legH + body * t, -d / 2]}
              color={p.wood}
              pull="knob"
              pullColor={p.metal}
            />
          ))}
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <Leg key={`${x}${z}`} position={[x * (w / 2 - 0.05), legH / 2, z * (d / 2 - 0.05)]} height={legH} top={0.022} bottom={0.013} splay={0.12} color={p.darkWood} />
            )),
          )}
        </group>
      );
    }

    case "dresser": {
      const plinth = 0.08;
      const body = h - plinth - 0.03;
      return (
        <group>
          <Slab size={[w - 0.06, plinth, d - 0.05]} position={[0, plinth / 2, 0]} kind="darkWood" color={p.darkWood} radius={0.005} />
          <Slab size={[w, body, d]} position={[0, plinth + body / 2, 0]} kind="wood" color={p.wood} radius={0.008} roughness={0.5} />
          <Slab size={[w + 0.04, 0.03, d + 0.03]} position={[0, h - 0.015, 0]} kind="wood" color={p.wood} radius={0.008} roughness={0.4} />
          {[0.17, 0.5, 0.83].flatMap((t) =>
            [-1, 1].map((x) => (
              <DrawerFront
                key={`${t}${x}`}
                width={w / 2 - 0.04}
                height={body * 0.28}
                position={[x * (w / 4), plinth + body * t, -d / 2]}
                color={p.wood}
                pull="knob"
                pullColor={p.metal}
              />
            )),
          )}
        </group>
      );
    }

    case "bench": {
      const seatY = h - 0.05;
      const slats = 4;
      return (
        <group>
          {Array.from({ length: slats }, (_, i) => (
            <Slab
              key={i}
              size={[w - 0.06, 0.035, (d - 0.06) / slats - 0.018]}
              position={[0, seatY, -(d - 0.06) / 2 + ((d - 0.06) / slats) * (i + 0.5)]}
              kind="wood"
              color={p.wood}
              radius={0.012}
              roughness={0.45}
            />
          ))}
          {[-1, 1].map((x) => (
            <Slab key={x} size={[0.035, 0.06, d - 0.08]} position={[x * (w / 2 - 0.1), seatY - 0.048, 0]} kind="darkWood" color={p.darkWood} radius={0.008} />
          ))}
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <Leg key={`${x}${z}`} position={[x * (w / 2 - 0.1), (h - 0.08) / 2, z * (d / 2 - 0.08)]} height={h - 0.08} top={0.03} bottom={0.019} splay={0.08} color={p.darkWood} />
            )),
          )}
        </group>
      );
    }

    case "ottoman": {
      const legH = 0.08;
      const drum = h - legH;
      return (
        <group>
          <Cushion size={[w, drum, d]} position={[0, legH + drum / 2, 0]} color={p.fabric} kind={cloth} plump={0.7} />
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <mesh key={`${x}${z}`} position={[x * (w / 2 - 0.11), legH * 0.55, z * (d / 2 - 0.11)]} castShadow receiveShadow>
                <sphereGeometry args={[legH * 0.55, 12, 10]} />
                <Surface kind="darkWood" color={p.darkWood} roughness={0.4} span={0.12} />
              </mesh>
            )),
          )}
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <mesh key={`t${x}${z}`} position={[x * w * 0.19, h - 0.012, z * d * 0.19]} rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
                <sphereGeometry args={[0.022, 10, 8]} />
                <Surface kind={cloth} color={p.cushion} roughness={0.9} span={0.06} />
              </mesh>
            )),
          )}
        </group>
      );
    }

    case "toilet": {
      const tankZ = d / 2 - 0.09;
      return (
        <group>
          <Lathe
            profile={[[0.11, 0], [0.13, 0.02], [0.1, 0.14], [0.115, 0.3], [0.175, 0.38], [0.18, 0.4], [0.165, 0.4], [0.15, 0.36], [0.1, 0.3], [0.085, 0.14], [0.1, 0.02], [0, 0.015]]}
            position={[0, 0, -0.03]}
            color="#f2f1ef"
            kind="ceramic"
            roughness={0.14}
            segments={32}
          />
          <mesh position={[0, 0.405, -0.03]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <torusGeometry args={[0.155, 0.022, 10, 28]} />
            <Surface kind="ceramic" color="#fbfbfa" roughness={0.16} span={0.3} />
          </mesh>
          <Slab size={[0.32, 0.022, 0.34]} position={[0, 0.435, 0.04]} rotation={[-0.32, 0, 0]} kind="ceramic" color="#fbfbfa" radius={0.01} roughness={0.16} />
          <Slab size={[0.36, 0.5, 0.17]} position={[0, 0.5, tankZ]} kind="ceramic" color="#f2f1ef" radius={0.022} roughness={0.14} />
          <Slab size={[0.38, 0.03, 0.19]} position={[0, 0.76, tankZ]} kind="ceramic" color="#fbfbfa" radius={0.01} roughness={0.14} />
          <mesh position={[0, 0.782, tankZ]} castShadow>
            <cylinderGeometry args={[0.032, 0.032, 0.012, 18]} />
            <Surface kind="metal" color={p.metal} roughness={0.2} metalness={0.9} span={0.08} envMapIntensity={1.6} />
          </mesh>
        </group>
      );
    }

    case "bathtub": {
      const wall = 0.07;
      const rim = 0.56;
      return (
        <group>
          <Slab size={[w, 0.06, d]} position={[0, 0.03, 0]} kind="ceramic" color="#e6e4e1" radius={0.012} roughness={0.3} />
          {[-1, 1].map((x) => (
            <Slab key={`x${x}`} size={[wall, rim, d]} position={[x * (w - wall) / 2, rim / 2, 0]} kind="ceramic" color="#fbfbfa" radius={0.035} roughness={0.13} />
          ))}
          {[-1, 1].map((z) => (
            <Slab key={`z${z}`} size={[w - wall * 2, rim, wall]} position={[0, rim / 2, z * (d - wall) / 2]} kind="ceramic" color="#fbfbfa" radius={0.035} roughness={0.13} />
          ))}
          <Slab size={[w - wall * 1.7, 0.05, d - wall * 1.7]} position={[0, 0.085, 0]} kind="ceramic" color="#f4f3f1" radius={0.025} roughness={0.13} />
          <Frame
            width={w + 0.04}
            height={d + 0.04}
            bar={wall + 0.05}
            thickness={0.05}
            position={[0, rim + 0.025, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            color="#ffffff"
            kind="ceramic"
            roughness={0.11}
          />
          <Glass size={[w - wall * 2.4, 0.006, d - wall * 2.4]} position={[0, rim - 0.16, 0]} color="#cfe6f0" opacity={0.35} />
          <mesh position={[0, 0.115, 0]} castShadow={false}>
            <cylinderGeometry args={[0.03, 0.03, 0.008, 16]} />
            <Surface kind="metal" color={p.metal} roughness={0.24} metalness={0.85} span={0.08} />
          </mesh>
          <Tube position={[w / 2 - 0.16, rim + 0.14, 0]} length={0.22} radius={0.02} color={p.metal} />
          <mesh position={[w / 2 - 0.16, rim + 0.25, -0.07]} rotation={[Math.PI / 2, 0, Math.PI / 2]} castShadow>
            <torusGeometry args={[0.07, 0.02, 8, 20, Math.PI / 2]} />
            <Surface kind="metal" color={p.metal} roughness={0.2} metalness={0.9} span={0.2} envMapIntensity={1.6} />
          </mesh>
          <Tube position={[w / 2 - 0.16, rim + 0.28, -0.14]} rotation={[Math.PI / 2, 0, 0]} length={0.08} radius={0.014} color={p.metal} />
          {[-1, 1].map((side) => (
            <mesh key={side} position={[w / 2 - 0.16 + side * 0.11, rim + 0.09, 0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.022, 0.026, 0.05, 14]} />
              <Surface kind="metal" color={p.metal} roughness={0.2} metalness={0.88} span={0.08} />
            </mesh>
          ))}
        </group>
      );
    }

    case "wall-mirror": {
      const bar = 0.06;
      // Drawn from its underside up, so mountHeight means the same thing here
      // as it does for a wall shelf.
      const mid = h / 2;
      return (
        <group>
          <Slab size={[w - bar, h - bar, 0.016]} position={[0, mid, 0.004]} kind="darkWood" color={p.darkWood} radius={0.004} roughness={0.5} />
          {/* Not a true mirror: it reflects the baked environment, not the room,
              so it is cooled and damped to read as glass rather than bronze. */}
          <Reflective
            size={[w - bar * 2, h - bar * 2, 0.006]}
            position={[0, mid, -0.008]}
            color="#e2ecf2"
            roughness={0.05}
            metalness={0.82}
          />
          <Frame
            width={w}
            height={h}
            bar={bar}
            thickness={0.05}
            position={[0, mid, -0.011]}
            color={p.wood}
            kind="darkWood"
            roughness={0.45}
          />
        </group>
      );
    }

    case "refrigerator": {
      const split = h * 0.63;
      return (
        <group>
          <Slab size={[w, h - 0.06, d]} position={[0, (h - 0.06) / 2 + 0.06, 0]} kind="metal" color={p.shell} radius={0.02} roughness={0.32} metalness={0.5} />
          <Slab size={[w - 0.04, 0.06, d - 0.05]} position={[0, 0.03, 0]} kind="metal" color="#3a3f45" radius={0.006} roughness={0.6} />
          <Slab size={[w - 0.02, split - 0.1, 0.035]} position={[0, 0.08 + (split - 0.1) / 2, -d / 2 - 0.017]} kind="metal" color="#cfd4d9" radius={0.014} roughness={0.26} metalness={0.68} />
          <Slab size={[w - 0.02, h - split - 0.09, 0.035]} position={[0, split + (h - split - 0.09) / 2 + 0.02, -d / 2 - 0.017]} kind="metal" color="#cfd4d9" radius={0.014} roughness={0.26} metalness={0.68} />
          {[0.08 + (split - 0.1) * 0.72, split + (h - split) * 0.16].map((y, i) => (
            <Tube key={i} position={[w * 0.36, y, -d / 2 - 0.06]} length={i === 0 ? split * 0.5 : (h - split) * 0.45} radius={0.014} color={p.metal} />
          ))}
          {[0.08 + (split - 0.1) * 0.72, split + (h - split) * 0.16].flatMap((y, i) =>
            [-1, 1].map((s) => (
              <Tube
                key={`${i}${s}`}
                position={[w * 0.36, y + s * (i === 0 ? split * 0.22 : (h - split) * 0.2), -d / 2 - 0.05]}
                rotation={[Math.PI / 2, 0, 0]}
                length={0.03}
                radius={0.009}
                color={p.metal}
              />
            )),
          )}
          <Slab size={[0.16, 0.09, 0.008]} position={[-w * 0.26, split + (h - split) * 0.55, -d / 2 - 0.037]} kind="metal" color="#14181c" radius={0.006} roughness={0.2} metalness={0.3} />
        </group>
      );
    }

    case "stove": {
      const bodyH = h - 0.05;
      return (
        <group>
          <Slab size={[w, bodyH - 0.06, d]} position={[0, (bodyH - 0.06) / 2 + 0.06, 0]} kind="metal" color="#5b6067" radius={0.014} roughness={0.36} metalness={0.55} />
          <Slab size={[w - 0.04, 0.06, d - 0.06]} position={[0, 0.03, 0]} kind="metal" color="#33383e" radius={0.005} roughness={0.6} />
          <Slab size={[w - 0.03, bodyH * 0.62, 0.03]} position={[0, bodyH * 0.36, -d / 2 - 0.015]} kind="metal" color="#4d5259" radius={0.01} roughness={0.32} metalness={0.6} />
          <Reflective size={[w - 0.2, bodyH * 0.4, 0.006]} position={[0, bodyH * 0.36, -d / 2 - 0.032]} color="#1a1e22" roughness={0.09} metalness={0.6} />
          <Tube position={[0, bodyH * 0.68, -d / 2 - 0.06]} rotation={[0, 0, Math.PI / 2]} length={w - 0.1} radius={0.014} color="#b9bec4" />
          {[-1, 1].map((s) => (
            <Tube key={s} position={[s * (w / 2 - 0.06), bodyH * 0.68, -d / 2 - 0.045]} rotation={[Math.PI / 2, 0, 0]} length={0.03} radius={0.009} color="#b9bec4" />
          ))}
          {[-1.5, -0.5, 0.5, 1.5].map((i) => (
            <mesh key={i} position={[i * w * 0.19, bodyH * 0.86, -d / 2 - 0.028]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.026, 0.03, 0.03, 16]} />
              <Surface kind="metal" color="#22262a" roughness={0.35} metalness={0.5} span={0.08} />
            </mesh>
          ))}
          <Slab size={[w + 0.02, 0.035, d + 0.02]} position={[0, h - 0.018, 0]} kind="metal" color="#26292d" radius={0.008} roughness={0.22} metalness={0.4} />
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <group key={`${x}${z}`} position={[x * w * 0.23, h, z * d * 0.21]}>
                <mesh position={[0, 0.004, 0]} castShadow>
                  <cylinderGeometry args={[0.085, 0.085, 0.008, 20]} />
                  <Surface kind="metal" color="#15181b" roughness={0.5} metalness={0.4} span={0.2} />
                </mesh>
                {[0, 1, 2].map((k) => (
                  <mesh key={k} position={[0, 0.016, 0]} rotation={[0, (k * Math.PI) / 3, 0]} castShadow>
                    <boxGeometry args={[0.17, 0.012, 0.012]} />
                    <Surface kind="metal" color="#26292d" roughness={0.55} metalness={0.35} span={0.2} />
                  </mesh>
                ))}
              </group>
            )),
          )}
        </group>
      );
    }

    case "kitchen-sink": {
      const toe = 0.09;
      const body = h - toe - 0.05;
      const basin = { w: w * 0.66, d: d * 0.56, drop: 0.19 };
      const topY = h - 0.022;
      const railZ = (d + 0.04 - basin.d) / 4;
      return (
        <group>
          <Slab size={[w - 0.1, toe, d - 0.08]} position={[0, toe / 2, 0.01]} kind="metal" color="#4b4f54" radius={0.004} roughness={0.6} />
          <Slab size={[w, body, d]} position={[0, toe + body / 2, 0]} kind="wood" color={p.shell} radius={0.008} roughness={0.55} />
          {[-1, 1].map((s) => (
            <PanelDoor key={s} width={w / 2 - 0.03} height={body - 0.04} position={[s * w * 0.25, toe + body / 2, -d / 2]} color={p.shell} frameColor={p.shell} />
          ))}
          {[-1, 1].map((s) => (
            <BarPull key={s} position={[s * 0.09, toe + body * 0.5, -d / 2 - 0.032]} length={body * 0.3} vertical color={p.metal} />
          ))}
          {/* Worktop drawn as four strips, leaving a real hole for the basin. */}
          {[-1, 1].map((s) => (
            <Slab
              key={`cx${s}`}
              size={[(w + 0.05 - basin.w) / 2, 0.045, d + 0.04]}
              position={[s * (w + 0.05 + basin.w) / 4, topY, 0]}
              kind="marble"
              color={p.stone}
              radius={0.01}
              roughness={0.2}
              relief={0.5}
            />
          ))}
          {[-1, 1].map((s) => (
            <Slab
              key={`cz${s}`}
              size={[basin.w, 0.045, railZ * 2]}
              position={[0, topY, s * (basin.d / 2 + railZ)]}
              kind="marble"
              color={p.stone}
              radius={0.01}
              roughness={0.2}
              relief={0.5}
            />
          ))}
          <Basin
            width={basin.w}
            depth={basin.d}
            drop={basin.drop}
            position={[0, topY - 0.022, 0]}
            color="#8a9096"
            kind="metal"
            roughness={0.26}
            metalness={0.8}
          />
          <mesh position={[0, topY - basin.drop - 0.012, 0]} castShadow={false}>
            <cylinderGeometry args={[0.026, 0.026, 0.006, 14]} />
            <Surface kind="metal" color="#5a6067" roughness={0.3} metalness={0.8} span={0.06} />
          </mesh>
          <Lathe
            profile={[[0.03, 0], [0.032, 0.012], [0.021, 0.02], [0.019, 0.11]]}
            position={[0, h + 0.01, d * 0.3]}
            color={p.metal}
            kind="metal"
            roughness={0.18}
            metalness={0.88}
          />
          <Tube position={[0, h + 0.19, d * 0.3]} length={0.17} radius={0.019} color={p.metal} />
          <mesh position={[0, h + 0.275, d * 0.21]} rotation={[0, Math.PI / 2, 0]} castShadow>
            <torusGeometry args={[0.09, 0.019, 8, 20, Math.PI / 2]} />
            <Surface kind="metal" color={p.metal} roughness={0.18} metalness={0.9} span={0.25} envMapIntensity={1.6} />
          </mesh>
          <Tube position={[0, h + 0.3, d * 0.32]} rotation={[Math.PI / 2, 0, 0]} length={0.1} radius={0.013} color={p.metal} />
          <Tube position={[0.055, h + 0.14, d * 0.3]} rotation={[0, 0, -0.5]} length={0.11} radius={0.011} color={p.metal} />
        </group>
      );
    }

    case "shower": {
      const post = 0.03;
      return (
        <group>
          <Slab size={[w, 0.09, d]} position={[0, 0.045, 0]} kind="ceramic" color="#eceae7" radius={0.012} roughness={0.2} />
          <Slab size={[w - 0.07, 0.03, d - 0.07]} position={[0, 0.08, 0]} kind="ceramic" color="#f6f5f3" radius={0.008} roughness={0.14} />
          <mesh position={[0, 0.096, 0]} castShadow={false}>
            <cylinderGeometry args={[0.045, 0.045, 0.006, 18]} />
            <Surface kind="metal" color="#9aa0a6" roughness={0.25} metalness={0.85} span={0.1} />
          </mesh>
          <Glass size={[w - post * 2, h - 0.14, 0.008]} position={[0, (h - 0.14) / 2 + 0.09, -d / 2 + post]} />
          <Glass size={[0.008, h - 0.14, d - post * 2]} position={[-w / 2 + post, (h - 0.14) / 2 + 0.09, 0]} />
          {[[-w / 2 + post, -d / 2 + post], [w / 2 - post, -d / 2 + post], [-w / 2 + post, d / 2 - post]].map(([x, z], i) => (
            <Slab key={i} size={[post, h - 0.09, post]} position={[x!, (h - 0.09) / 2 + 0.09, z!]} kind="metal" color="#aab0b6" radius={0.006} roughness={0.28} metalness={0.75} />
          ))}
          <Slab size={[w, post, post]} position={[0, h - 0.02, -d / 2 + post]} kind="metal" color="#aab0b6" radius={0.006} roughness={0.28} metalness={0.75} />
          <Tube position={[w * 0.34, h * 0.55, d / 2 - 0.05]} length={h * 0.72} radius={0.014} color="#b3b9bf" />
          <Tube position={[w * 0.34, h - 0.22, d * 0.18]} rotation={[Math.PI / 2, 0, 0]} length={0.36} radius={0.013} color="#b3b9bf" />
          <Lathe
            profile={[[0, 0], [0.085, 0.005], [0.088, 0.02], [0.05, 0.045], [0.02, 0.05]]}
            position={[w * 0.34, h - 0.28, 0]}
            rotation={[Math.PI, 0, 0]}
            color="#c2c8ce"
            kind="metal"
            roughness={0.2}
            metalness={0.85}
          />
        </group>
      );
    }

    case "console-table": {
      const topY = h - 0.018;
      return (
        <group>
          <Slab size={[w, 0.034, d]} position={[0, topY, 0]} kind="wood" color={p.wood} radius={0.012} roughness={0.34} />
          <Slab size={[w - 0.04, 0.022, d - 0.03]} position={[0, topY - 0.028, 0]} kind="wood" color={p.wood} radius={0.007} roughness={0.42} />
          <Slab size={[w - 0.2, 0.02, d - 0.08]} position={[0, h * 0.28, 0]} kind="darkWood" color={p.darkWood} radius={0.006} />
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <Leg key={`${x}${z}`} position={[x * (w / 2 - 0.08), (h - 0.05) / 2, z * (d / 2 - 0.06)]} height={h - 0.05} top={0.028} bottom={0.016} color={p.darkWood} />
            )),
          )}
          <Lathe
            profile={[[0, 0], [0.06, 0], [0.075, 0.06], [0.055, 0.17], [0.062, 0.2], [0.054, 0.202], [0.046, 0.172], [0.065, 0.06], [0.05, 0.006], [0, 0.004]]}
            position={[-w * 0.28, topY + 0.017, 0]}
            color={p.accent}
            kind="ceramic"
            roughness={0.28}
          />
          <Slab size={[0.24, 0.02, 0.18]} position={[w * 0.24, topY + 0.027, 0]} kind="paper" color={BOOK_COLOURS[1]!} radius={0.004} roughness={0.8} />
        </group>
      );
    }

    case "beanbag": {
      const lobes: Array<[number, number, number, number, number, number]> = [
        [0, h * 0.38, 0, w * 0.5, h * 0.42, d * 0.5],
        [-w * 0.16, h * 0.3, d * 0.14, w * 0.34, h * 0.32, d * 0.32],
        [w * 0.18, h * 0.28, -d * 0.12, w * 0.32, h * 0.3, d * 0.3],
        [0, h * 0.72, d * 0.16, w * 0.36, h * 0.3, d * 0.28],
      ];
      return (
        <group>
          {lobes.map(([x, y, z, sx, sy, sz], i) => (
            <mesh key={i} position={[x, y, z]} scale={[sx, sy, sz]} castShadow receiveShadow>
              <sphereGeometry args={[1, 22, 16]} />
              <Surface kind={cloth} color={i === 3 ? p.cushion : p.fabric} roughness={0.95} span={0.7} relief={1.2} />
            </mesh>
          ))}
          <mesh position={[0, h * 0.46, -d * 0.02]} scale={[w * 0.4, h * 0.12, d * 0.36]} receiveShadow>
            <sphereGeometry args={[1, 20, 14]} />
            <Surface kind={cloth} color={p.cushion} roughness={0.96} span={0.6} relief={1.2} />
          </mesh>
        </group>
      );
    }

    default:
      return <Slab size={[w, h, d]} position={[0, h / 2, 0]} kind="wood" color={p.wood} radius={0.02} />;
  }
}

# Layra

A browser-based room planner. Draw a floor plan by clicking corners, and the
walls extrude into 3D as you go. Reshape the room by dragging its corner
handles, adjust wall height and thickness, and save the scene to JSON.

Everything runs client-side - there is no backend.

## Getting started

Requires [Bun](https://bun.sh) 1.3.11 or newer.

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other commands, all run through Turborepo across every workspace:

```bash
bun run build        # production build
bun run test         # vitest
bun run check-types  # tsc --noEmit
bun run lint         # eslint
```

## Using it

**Draw mode.** Click on the ground plane to place corners. Each new point snaps
to a 15 degree angle increment from the previous one, then to a 0.1 m grid.
Press `Enter`, or click the first corner again, to close the loop - the room
then switches to edit mode. `Esc` clears an in-progress outline. An outline that
crosses itself is rejected rather than closed.

**Edit mode.** Drag the sphere handles on each corner to reshape the room. Walls
re-mitre and re-extrude live during the drag, and the whole gesture lands as a
single history entry.

**Walls.** The sidebar sliders set height (1.8-4 m) and thickness (0.05-0.6 m).
With no room drawn they set the defaults for the next one; with a room on screen
they apply to all of its walls.

**Save / Load.** Save downloads the scene as JSON. Load validates the file
before applying it and reports what is wrong if it fails. Loading goes through
the command stack, so importing the wrong file is undoable.

**History.** The sidebar lists every command, with undone ones dimmed below the
current position. The store exposes `undo()` and `redo()`, but nothing in the UI
calls them yet - no buttons, no keyboard shortcuts.

## Layout

```
apps/web          Next.js app - React Three Fiber canvas, toolbar, sidebar
packages/types    Scene, Room, Wall, Opening, Placement, and the scene version
packages/geometry Polygon ops, mitred offsetting, extrusion, triangulation
packages/state    Editor store and the do()/undo() command stack
```

Units are metres, Y is up, and the floor sits at Y=0. Plan-view math is all
`Vec2` (`x`/`z`); Y only appears once geometry is extruded.

### `@layra/geometry`

Pure functions - plain data in, typed arrays out. No React, no three.js scene
objects. `offsetPolygon` walks a closed polygon and mitres each corner, capped
by a mitre limit so sharp corners don't run to infinity; vertex count is
preserved, so index `i` still maps to index `i`. `extrudeWalls` turns the
centerline loop into outer face, inner face, and top cap. `triangulateFloor`
fills the inner loop. The only three.js import is `ShapeUtils`/`Vector2` for
triangulation, which keeps the renderer swappable.

### `@layra/state`

A `zustand/vanilla` store, so the package stays free of React. Every scene
mutation is a `Command` with `do`/`undo`, and each one captures explicit
before/after values at construction rather than recomputing - a redo always
lands on the same scene.

Transient state lives outside the command stack: the in-progress `draft`
polygon, the pointer `cursor`, and the mid-drag `dragging` position. That is why
a drag re-extrudes on every pointer move but writes only one history entry when
it ends, and nothing at all if the corner didn't move.

Scene JSON is validated field by field on load and gated on `SCENE_VERSION`
rather than trusted to be the right shape.

### `apps/web`

The R3F `Canvas` mounts its own reconciler root, so React context from the DOM
tree doesn't reach scene components. The editor store is a module singleton
instead. `Scene` is loaded with `ssr: false` because three.js needs browser
APIs.

Pointer picking raycasts against the Y=0 plane directly - no collider mesh.
OrbitControls listens on the canvas itself, so it is disabled during a handle
drag rather than relying on `stopPropagation`.

## Rendering

Nothing is loaded from disk. Every surface, every piece of furniture and every
door and window is built at runtime.

**Materials.** `textures.ts` generates tileable albedo, normal and roughness
maps for fifteen surface families - wood, floorboard, fabric, leather, plaster,
brick, carpet, tile, marble, metal, ceramic, paper, foliage. The value-noise
lattice takes separate cell counts per axis, so grain and brushing stretch
along one direction instead of swirling. Wood and floorboards render at 512;
everything else at 256. `Surface` wraps a `meshStandardMaterial` around them and
sets the tiling density from the surface's real-world size.

UVs are measured in metres throughout, so one texture tile covers a fixed
physical size whatever it is wrapped around. Wall and floor meshes get theirs
from `useMeshGeometry`, which projects each vertical face onto its own
horizontal tangent - projecting onto the nearest axis would squash a diagonal
wall by the cosine of its angle. Box parts get theirs from `geometry.ts`.

**Weathering.** `weather.ts` patches the standard material with two things a
tiling texture cannot carry: a world-space wash that hides the repeat and
burnishes traffic lanes, and a lightening along box edges. Both travel as
uniforms rather than baked constants, because three caches compiled programs by
cache key and interpolating each slab's extents into the source would mint a
separate program per piece of furniture.

**Geometry.** `parts.tsx` holds the primitives - bevelled slabs, cushions,
tapered legs, revolved lathe profiles, drawer fronts, shaker doors, basins,
frames - and `furniture/models.tsx` and `openings/models.tsx` assemble the
catalog and the openings from them. `geometry.ts` ref-counts the buffers, so a
sofa's four legs, a dresser's six drawer fronts and six identical dining chairs
all share one. Disposal is deferred a tick because Strict Mode unmounts and
immediately remounts.

**Light.** `RoomEnvironment` bakes a room-shaped image-based light from emissive
panels into a cube map once per lighting preset, taking the room's own floor and
wall colours for its bounce panels. No HDR is fetched, so it works offline. Each
window carries a rect area light for daylight fill; the directional key still
draws the hard sun patch through the same hole. `Postprocessing` adds N8AO,
which is what grounds furniture on the floor - it turns itself off on software
rasterisers, where a full-screen pass is unusable.

## Stack

Next.js 16, React 19, React Three Fiber 9 with three.js, drei, postprocessing,
Zustand 5, Tailwind CSS 4, Turborepo, Vitest, TypeScript in strict mode with
`noUncheckedIndexedAccess`.

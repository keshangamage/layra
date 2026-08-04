"use client";

import { useMemo, useState } from "react";
import { overlappingRooms } from "@layra/state";
import { editor, useEditor } from "@/state/editor";

export function RoomsPanel() {
  const rooms = useEditor((state) => state.scene.rooms);
  const activeIndex = useEditor((state) => state.activeRoomIndex);
  const showOtherRooms = useEditor((state) => state.showOtherRooms);
  const [editing, setEditing] = useState<number | null>(null);
  const activeRoomIsDrawn = (rooms[activeIndex]?.polygon.length ?? 0) >= 3;
  const overlapIds = useMemo(() => overlappingRooms(rooms), [rooms]);

  return (
    <section className="border-b border-zinc-800 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Rooms
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => editor().addRoom()}
            className="rounded px-1.5 py-0.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => editor().duplicateRoom()}
            className="rounded px-1.5 py-0.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            title="Duplicate the selected room and its furniture"
          >
            Copy
          </button>
        </div>
      </div>

      <ul className="mt-2 space-y-0.5">
        {rooms.map((room, index) => (
          <li key={room.id}>
            <div
              onClick={() => editor().setActiveRoom(index)}
              className={`flex cursor-pointer items-baseline justify-between rounded px-2 py-1 text-xs transition-colors ${
                index === activeIndex
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              {editing === index ? (
                <input
                  autoFocus
                  defaultValue={room.name}
                  aria-label="Room name"
                  onBlur={(event) => {
                    editor().renameRoom(index, event.target.value.trim() || room.name);
                    setEditing(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") setEditing(null);
                  }}
                  className="w-full bg-transparent text-xs text-zinc-100 outline-none"
                />
              ) : (
                <>
                  <span onDoubleClick={() => setEditing(index)}>{room.name}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] text-zinc-600">
                      {room.polygon.length >= 3 ? `${room.walls.length} walls` : "empty"}
                    </span>
                    {overlapIds.has(room.id) && (
                      <span
                        className="text-amber-400"
                        title="This room overlaps another room"
                        aria-label="Room overlaps another room"
                      >
                        !
                      </span>
                    )}
                    {rooms.length > 1 && (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Move ${room.name} up`}
                          disabled={index === 0}
                          onClick={(event) => {
                            event.stopPropagation();
                            editor().reorderRooms(index, index - 1);
                          }}
                          className="text-zinc-600 hover:text-zinc-200 disabled:opacity-20"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${room.name} down`}
                          disabled={index === rooms.length - 1}
                          onClick={(event) => {
                            event.stopPropagation();
                            editor().reorderRooms(index, index + 1);
                          }}
                          className="text-zinc-600 hover:text-zinc-200 disabled:opacity-20"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${room.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            editor().deleteRoom(index);
                          }}
                          className="text-zinc-500 hover:text-red-400"
                        >
                          ×
                        </button>
                      </span>
                    )}
                  </span>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[10px] text-zinc-600">
        Double-click a name to rename. Edits apply to the selected room.
      </p>
      {activeRoomIsDrawn && (
        <div className="mt-3 flex items-center justify-center gap-1">
          <button
            type="button"
            className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            title="Move room up"
            aria-label="Move room up"
            onClick={() => editor().moveActiveRoom(0, -0.5)}
          >
            ↑
          </button>
          <button
            type="button"
            className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            title="Move room left"
            aria-label="Move room left"
            onClick={() => editor().moveActiveRoom(-0.5, 0)}
          >
            ←
          </button>
          <button
            type="button"
            className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            title="Move room down"
            aria-label="Move room down"
            onClick={() => editor().moveActiveRoom(0, 0.5)}
          >
            ↓
          </button>
          <button
            type="button"
            className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            title="Move room right"
            aria-label="Move room right"
            onClick={() => editor().moveActiveRoom(0.5, 0)}
          >
            →
          </button>
        </div>
      )}
      {activeRoomIsDrawn && (
        <div className="mt-1 flex justify-center gap-1">
          <button
            type="button"
            className="rounded px-2 py-1 text-[10px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            title="Rotate room left"
            aria-label="Rotate room left"
            onClick={() => editor().rotateActiveRoom(-Math.PI / 2)}
          >
            ↺ 90°
          </button>
          <button
            type="button"
            className="rounded px-2 py-1 text-[10px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            title="Rotate room right"
            aria-label="Rotate room right"
            onClick={() => editor().rotateActiveRoom(Math.PI / 2)}
          >
            ↻ 90°
          </button>
        </div>
      )}
      {rooms.length > 1 && (
        <button
          type="button"
          className="mt-2 w-full rounded border border-zinc-800 px-2 py-1 text-left text-[10px] text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
          onClick={() => editor().toggleOtherRooms()}
          aria-pressed={showOtherRooms}
        >
          {showOtherRooms ? "Hide other rooms" : "Show other rooms"}
        </button>
      )}
    </section>
  );
}

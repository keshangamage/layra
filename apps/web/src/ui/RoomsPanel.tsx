"use client";

import { useState } from "react";
import { editor, useEditor } from "@/state/editor";

export function RoomsPanel() {
  const rooms = useEditor((state) => state.scene.rooms);
  const activeIndex = useEditor((state) => state.activeRoomIndex);
  const [editing, setEditing] = useState<number | null>(null);

  return (
    <section className="border-b border-zinc-800 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Rooms
        </h2>
        <button
          type="button"
          onClick={() => editor().addRoom()}
          className="rounded px-1.5 py-0.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          Add
        </button>
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
                    {rooms.length > 1 && (
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
    </section>
  );
}

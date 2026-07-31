"use client";

import type { ReactNode } from "react";

export function Sidebar({ children }: { children: ReactNode }) {
  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-zinc-800 bg-zinc-950">
      {children}
      <section className="p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          History
        </h2>
        <p className="mt-2 text-xs text-zinc-600">
          Undo stack lands with the command layer.
        </p>
      </section>
    </aside>
  );
}

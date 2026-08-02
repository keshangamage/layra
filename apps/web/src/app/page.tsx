"use client";

import dynamic from "next/dynamic";
import { Toolbar } from "@/ui/Toolbar";
import { Sidebar } from "@/ui/Sidebar";
import { KeyboardShortcuts } from "@/ui/KeyboardShortcuts";
import { useAutosave } from "@/state/useAutosave";

// three.js needs browser APIs, and Next 16 only allows ssr:false in a Client Component.
const Scene = dynamic(() => import("@/components/Scene"), {
  ssr: false,
  loading: () => <div className="h-full bg-zinc-900" />,
});

export default function Home() {
  useAutosave();

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <KeyboardShortcuts />
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="relative flex-1">
          <Scene />
        </main>
      </div>
    </div>
  );
}

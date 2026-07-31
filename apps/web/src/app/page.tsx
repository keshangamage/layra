"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Toolbar, type Mode } from "@/ui/Toolbar";
import { Sidebar } from "@/ui/Sidebar";
import { SettingsPanel } from "@/ui/SettingsPanel";

// three.js touches browser APIs, and Next 16 only allows ssr:false in a Client Component.
const Scene = dynamic(() => import("@/components/Scene"), {
  ssr: false,
  loading: () => <div className="flex-1 bg-zinc-900" />,
});

export default function Home() {
  const [mode, setMode] = useState<Mode>("draw");
  const [wallHeight, setWallHeight] = useState(2.5);
  const [wallThickness, setWallThickness] = useState(0.2);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Toolbar mode={mode} onModeChange={setMode} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar>
          <SettingsPanel
            wallHeight={wallHeight}
            wallThickness={wallThickness}
            onWallHeightChange={setWallHeight}
            onWallThicknessChange={setWallThickness}
          />
        </Sidebar>
        <main className="relative flex-1">
          <Scene wallHeight={wallHeight} wallThickness={wallThickness} />
        </main>
      </div>
    </div>
  );
}

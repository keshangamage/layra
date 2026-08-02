"use client";

import { SettingsPanel } from "./SettingsPanel";
import { RoomStats } from "./RoomStats";
import { OpeningsPanel } from "./OpeningsPanel";
import { CatalogPanel } from "./CatalogPanel";
import { SelectionPanel } from "./SelectionPanel";
import { HistoryList } from "./HistoryList";

export function Sidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-zinc-800 bg-zinc-950">
      <SettingsPanel />
      <RoomStats />
      <OpeningsPanel />
      <CatalogPanel />
      <SelectionPanel />
      <HistoryList />
    </aside>
  );
}

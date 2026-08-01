import { describe, expect, it } from "vitest";
import { createEditorStore } from "./store";

function store() {
  return createEditorStore();
}

describe("measure tool", () => {
  it("starts empty", () => {
    expect(store().getState().measure).toEqual({ from: null, to: null });
  });

  it("places the first point", () => {
    const s = store();
    s.getState().addMeasurePoint({ x: 1, z: 2 });
    expect(s.getState().measure).toEqual({ from: { x: 1, z: 2 }, to: null });
  });

  it("places the second point", () => {
    const s = store();
    s.getState().addMeasurePoint({ x: 1, z: 2 });
    s.getState().addMeasurePoint({ x: 4, z: 6 });
    expect(s.getState().measure.to).toEqual({ x: 4, z: 6 });
  });

  it("starts a fresh measurement on the third click", () => {
    const s = store();
    s.getState().addMeasurePoint({ x: 0, z: 0 });
    s.getState().addMeasurePoint({ x: 3, z: 4 });
    s.getState().addMeasurePoint({ x: 9, z: 9 });
    expect(s.getState().measure).toEqual({ from: { x: 9, z: 9 }, to: null });
  });

  it("clears on demand", () => {
    const s = store();
    s.getState().addMeasurePoint({ x: 1, z: 1 });
    s.getState().clearMeasure();
    expect(s.getState().measure).toEqual({ from: null, to: null });
    expect(s.getState().cursor).toBeNull();
  });

  it("tracks the cursor only between the two clicks", () => {
    const s = store();
    s.getState().setMeasureCursor({ x: 5, z: 5 });
    expect(s.getState().cursor).toBeNull();

    s.getState().addMeasurePoint({ x: 0, z: 0 });
    s.getState().setMeasureCursor({ x: 5, z: 5 });
    expect(s.getState().cursor).toEqual({ x: 5, z: 5 });

    s.getState().addMeasurePoint({ x: 1, z: 1 });
    s.getState().setMeasureCursor({ x: 9, z: 9 });
    expect(s.getState().cursor).toEqual({ x: 5, z: 5 });
  });

  it("never enters history", () => {
    const s = store();
    s.getState().addMeasurePoint({ x: 0, z: 0 });
    s.getState().addMeasurePoint({ x: 3, z: 4 });
    expect(s.getState().past).toHaveLength(0);
  });

  it("resets when the mode changes", () => {
    const s = store();
    s.getState().addMeasurePoint({ x: 1, z: 1 });
    s.getState().setMode("draw");
    expect(s.getState().measure).toEqual({ from: null, to: null });
  });
});

describe("dimension toggle", () => {
  it("is on by default and flips", () => {
    const s = store();
    expect(s.getState().showDimensions).toBe(true);
    s.getState().toggleDimensions();
    expect(s.getState().showDimensions).toBe(false);
  });

  it("stays out of history", () => {
    const s = store();
    s.getState().toggleDimensions();
    expect(s.getState().past).toHaveLength(0);
  });
});

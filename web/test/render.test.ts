import { describe, it, expect } from "vitest";
import {
  fitView,
  worldToScreenX,
  worldToScreenY,
  screenToWorldX,
  zoomAt,
  pan,
  shouldHeatmap,
  binDensity,
} from "@/lib/render/view";

const DIE = { x0: 0, y0: 0, x1: 1000, y1: 1000 };

describe("view transform", () => {
  it("fitView centers the die and respects padding", () => {
    const v = fitView(DIE, 800, 800, 0.1);
    expect(v.cx).toBe(500);
    expect(v.cy).toBe(500);
    expect(v.scale).toBeCloseTo((800 / 1000) * 0.8);
  });

  it("die center maps to viewport center; y is flipped", () => {
    const v = fitView(DIE, 800, 600);
    expect(worldToScreenX(500, v)).toBeCloseTo(400);
    expect(worldToScreenY(500, v)).toBeCloseTo(300);
    // higher world-y => smaller screen-y
    expect(worldToScreenY(800, v)).toBeLessThan(worldToScreenY(200, v));
  });

  it("screenToWorld inverts worldToScreen", () => {
    const v = fitView(DIE, 800, 600);
    expect(screenToWorldX(worldToScreenX(321, v), v)).toBeCloseTo(321);
  });

  it("zoomAt keeps the cursor point anchored", () => {
    const v = fitView(DIE, 800, 600);
    const z = zoomAt(v, 200, 150, 2, [1e-7, 10]);
    expect(z.scale).toBeCloseTo(v.scale * 2);
    // world point under (200,150) is unchanged
    expect(screenToWorldX(200, z)).toBeCloseTo(screenToWorldX(200, v));
  });

  it("pan shifts center by pixel delta / scale", () => {
    const v = fitView(DIE, 800, 600);
    const p = pan(v, v.scale * 100, 0);
    expect(p.cx).toBeCloseTo(v.cx - 100);
  });
});

describe("LOD", () => {
  it("heatmaps when cells render sub-pixel", () => {
    expect(shouldHeatmap(216, 0.001)).toBe(true); // 0.216px
    expect(shouldHeatmap(216, 0.05)).toBe(false); // 10.8px
  });
});

describe("density binning", () => {
  it("accumulates cell area into the right bin and normalizes", () => {
    const cells = {
      x: Int32Array.from([10, 12, 800]),
      y: Int32Array.from([10, 14, 800]),
      w: Int32Array.from([4, 4, 4]),
      h: Int32Array.from([4, 4, 4]),
      count: 3,
    };
    const g = binDensity(DIE, cells, 10, 10); // 100 dbu per bin
    // two cells in bin (0,0), one in bin (8,8)
    expect(g.values[0]).toBeCloseTo(1); // max bin -> 1.0
    expect(g.values[8 * 10 + 8]).toBeCloseTo(0.5);
  });
});

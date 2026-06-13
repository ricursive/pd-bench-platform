import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseDef } from "@/lib/def/parse";
import { parseLefMacros } from "@/lib/def/lef";

const FIX = resolve(__dirname, "../../fixtures/ariane133");
const sizes = parseLefMacros(readFileSync(resolve(FIX, "cells.lef"), "utf8"));

describe("synthetic ariane133 fixture", () => {
  it("floorplan DEF: substrate present, everything unplaced", () => {
    const p = parseDef(readFileSync(resolve(FIX, "ariane133_fp.def"), "utf8"), sizes);
    expect(p.substrate.die.x1).toBeGreaterThan(0);
    expect(p.substrate.rows.length).toBeGreaterThan(100);
    expect(p.substrate.pins.length).toBeGreaterThan(0);
    expect(p.macros.every((m) => m.status === "UNPLACED")).toBe(true);
    expect(p.cells.count).toBe(0); // none placed yet
    expect(p.unplaced).toBeGreaterThan(12000);
  });

  it("final placed DEF: 133 macros + thousands of placed cells", () => {
    const p = parseDef(readFileSync(resolve(FIX, "ariane133_placed.def"), "utf8"), sizes);
    expect(p.macros.length).toBe(133);
    expect(p.macros.every((m) => m.status === "PLACED")).toBe(true);
    expect(p.cells.count).toBeGreaterThan(10000);
    expect(p.unplaced).toBe(0);
  });
});

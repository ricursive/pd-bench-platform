import { describe, it, expect } from "vitest";
import { parseDef } from "@/lib/def/parse";
import { parseLefMacros } from "@/lib/def/lef";

const LEF = `
VERSION 5.8 ;
MACRO sram_asap7_16x256_1rw
  CLASS BLOCK ;
  SIZE 24.0000 BY 33.0000 ;
END sram_asap7_16x256_1rw

MACRO INVx1_ASAP7_75t_R
  CLASS CORE ;
  SIZE 0.2700 BY 1.0800 ;
END INVx1_ASAP7_75t_R
`;

const DEF = `
VERSION 5.8 ;
DESIGN ariane ;
UNITS DISTANCE MICRONS 4000 ;
DIEAREA ( 0 0 ) ( 5040000 5040000 ) ;
ROW ROW_0 asap7sc7p5t 0 0 N DO 23333 BY 1 STEP 216 0 ;
ROW ROW_1 asap7sc7p5t 0 4320 N DO 23333 BY 1 STEP 216 0 ;
TRACKS X 54 DO 11666 STEP 432 LAYER M2 ;

COMPONENTS 3 ;
- macro_0 sram_asap7_16x256_1rw + PLACED ( 80000 80000 ) N ;
- cell_0 INVx1_ASAP7_75t_R + PLACED ( 120000 4320 ) N ;
- cell_1 INVx1_ASAP7_75t_R + UNPLACED ;
END COMPONENTS

PINS 1 ;
- pin_0 + NET pin_0 + DIRECTION INPUT + USE SIGNAL + LAYER M4 ( -70 -70 ) ( 70 70 ) + FIXED ( 2520000 0 ) N ;
END PINS

END DESIGN
`;

describe("DEF/LEF parser", () => {
  const sizes = parseLefMacros(LEF);
  const p = parseDef(DEF, sizes);

  it("parses LEF macro sizes + class", () => {
    expect(sizes.get("sram_asap7_16x256_1rw")).toEqual({ w: 24, h: 33, isBlock: true });
    expect(sizes.get("INVx1_ASAP7_75t_R")?.isBlock).toBe(false);
  });

  it("reads units and die area", () => {
    expect(p.design).toBe("ariane");
    expect(p.substrate.dbuPerMicron).toBe(4000);
    expect(p.substrate.die).toEqual({ x0: 0, y0: 0, x1: 5040000, y1: 5040000 });
  });

  it("reads rows, tracks, pins", () => {
    expect(p.substrate.rows.length).toBe(2);
    expect(p.substrate.rows[1]).toMatchObject({ y: 4320, numX: 23333, stepX: 216 });
    expect(p.substrate.tracks[0]).toMatchObject({ axis: "X", num: 11666, step: 432, layer: "M2" });
    expect(p.substrate.pins[0]).toMatchObject({ name: "pin_0", x: 2520000, y: 0, status: "FIXED" });
  });

  it("separates macros from std cells with dbu-scaled bbox", () => {
    expect(p.macros.length).toBe(1);
    expect(p.macros[0]).toMatchObject({ name: "macro_0", x: 80000, y: 80000 });
    // 24um * 4000 dbu/um, 33um * 4000
    expect(p.macros[0].w).toBe(96000);
    expect(p.macros[0].h).toBe(132000);
  });

  it("places std cells into typed arrays and counts unplaced", () => {
    expect(p.cells.count).toBe(1);
    expect(p.cells.x[0]).toBe(120000);
    expect(p.cells.w[0]).toBe(1080); // 0.27 * 4000
    expect(p.unplaced).toBe(1);
    expect(p.categories).toContain("INVx1_ASAP7_75t_R");
  });

  it("swaps w/h for rotated orientations", () => {
    const rotated = DEF.replace("PLACED ( 80000 80000 ) N", "PLACED ( 80000 80000 ) E");
    const pr = parseDef(rotated, sizes);
    expect(pr.macros[0].w).toBe(132000);
    expect(pr.macros[0].h).toBe(96000);
  });
});

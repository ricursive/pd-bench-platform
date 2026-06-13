import {
  type DieArea,
  type MacroInst,
  type MacroSize,
  type PlacementPayload,
  type Pin,
  type Row,
  type Substrate,
  type Track,
  PLACED_STATUSES,
  ROTATED_ORIENTS,
} from "./types";

/** Yield DEF statements as token lists (statements end with ';'). */
function* statements(text: string): Generator<string[]> {
  let tokens: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    for (const token of line.split(/\s+/)) {
      if (token === ";") {
        if (tokens.length) {
          yield tokens;
          tokens = [];
        }
      } else if (token.endsWith(";")) {
        tokens.push(token.slice(0, -1));
        yield tokens;
        tokens = [];
      } else {
        tokens.push(token);
      }
    }
    if (tokens.length && tokens[0] === "END") {
      yield tokens;
      tokens = [];
    }
  }
  if (tokens.length) yield tokens;
}

function normalize(token: string): string {
  return token.replace(/\\/g, "");
}

/** bbox w/h for a master at a given orientation (microns -> dbu). */
function bbox(size: MacroSize, orient: string, dbu: number): [number, number] {
  let w = Math.round(size.w * dbu);
  let h = Math.round(size.h * dbu);
  if (ROTATED_ORIENTS.has(orient)) [w, h] = [h, w];
  return [w, h];
}

const DEFAULT_CELL: MacroSize = { w: 0.2, h: 1.08, isBlock: false };

/**
 * Parse a DEF (plus LEF macro sizes) into a render-ready PlacementPayload.
 * Unknown masters fall back to a default std-cell footprint so the renderer
 * never crashes on an unfamiliar library.
 */
export function parseDef(
  text: string,
  sizes: Map<string, MacroSize>,
): PlacementPayload {
  let design = "";
  let dbu = 1000;
  let die: DieArea = { x0: 0, y0: 0, x1: 0, y1: 0 };
  const rows: Row[] = [];
  const tracks: Track[] = [];
  const pins: Pin[] = [];
  const macros: MacroInst[] = [];

  // category interning for std cells
  const catIndex = new Map<string, number>();
  const categories: string[] = [];
  const catOf = (master: string): number => {
    let i = catIndex.get(master);
    if (i === undefined) {
      i = categories.length;
      categories.push(master);
      catIndex.set(master, i);
    }
    return i;
  };

  // growable cell buffers
  const cx: number[] = [];
  const cy: number[] = [];
  const cw: number[] = [];
  const ch: number[] = [];
  const ccat: number[] = [];
  let unplaced = 0;

  let section: "" | "components" | "pins" = "";
  let pendingPin: Partial<Pin> | null = null;

  for (const tok of statements(text)) {
    const head = tok[0];

    if (head === "DESIGN") {
      design = tok[1] ?? "";
    } else if (head === "UNITS" && tok[1] === "DISTANCE" && tok[2] === "MICRONS") {
      dbu = parseInt(tok[3], 10);
    } else if (head === "DIEAREA") {
      const nums = tok.slice(1).filter((t) => t !== "(" && t !== ")").map(Number);
      if (nums.length >= 4) {
        die = { x0: nums[0], y0: nums[1], x1: nums[2], y1: nums[3] };
      }
    } else if (head === "ROW") {
      // ROW name site x y orient DO numX BY numY STEP stepX stepY
      const doI = tok.indexOf("DO");
      const byI = tok.indexOf("BY");
      const stepI = tok.indexOf("STEP");
      rows.push({
        site: tok[2],
        x: parseInt(tok[3], 10),
        y: parseInt(tok[4], 10),
        orient: tok[5],
        numX: doI >= 0 ? parseInt(tok[doI + 1], 10) : 1,
        numY: byI >= 0 ? parseInt(tok[byI + 1], 10) : 1,
        stepX: stepI >= 0 ? parseInt(tok[stepI + 1], 10) : 0,
        stepY: stepI >= 0 ? parseInt(tok[stepI + 2], 10) : 0,
      });
    } else if (head === "TRACKS") {
      // TRACKS axis start DO num STEP step LAYER layer
      const doI = tok.indexOf("DO");
      const stepI = tok.indexOf("STEP");
      const layerI = tok.indexOf("LAYER");
      tracks.push({
        axis: tok[1] as "X" | "Y",
        start: parseInt(tok[2], 10),
        num: doI >= 0 ? parseInt(tok[doI + 1], 10) : 0,
        step: stepI >= 0 ? parseInt(tok[stepI + 1], 10) : 0,
        layer: layerI >= 0 ? tok[layerI + 1] : "",
      });
    } else if (head === "COMPONENTS") {
      section = "components";
    } else if (head === "PINS") {
      section = "pins";
    } else if (head === "END") {
      section = "";
    } else if (head === "-" && section === "components") {
      // - name master + STATUS ( x y ) ORIENT ;   | + UNPLACED
      const name = normalize(tok[1]);
      const master = normalize(tok[2]);
      let status = "UNPLACED";
      let x = 0;
      let y = 0;
      let orient = "N";
      for (let i = 3; i < tok.length; i++) {
        const t = tok[i];
        if (t === "PLACED" || t === "FIXED" || t === "COVER" || t === "UNPLACED") {
          status = t;
          if (t !== "UNPLACED" && tok[i + 1] === "(") {
            x = parseInt(tok[i + 2], 10);
            y = parseInt(tok[i + 3], 10);
            orient = tok[i + 5] ?? "N";
          }
        }
      }
      const placed = PLACED_STATUSES.has(status);
      if (!placed) unplaced++;
      const size = sizes.get(master) ?? DEFAULT_CELL;
      const [w, h] = bbox(size, orient, dbu);
      if (size.isBlock) {
        macros.push({ name, master, x, y, w, h, orient, status });
      } else if (placed) {
        cx.push(x);
        cy.push(y);
        cw.push(w);
        ch.push(h);
        ccat.push(catOf(master));
      } else {
        // unplaced std cell: still record category for the inventory panel
        catOf(master);
      }
    } else if (head === "-" && section === "pins") {
      const name = normalize(tok[1]);
      let x = 0;
      let y = 0;
      let status = "FIXED";
      for (let i = 2; i < tok.length; i++) {
        if ((tok[i] === "FIXED" || tok[i] === "PLACED" || tok[i] === "COVER") && tok[i + 1] === "(") {
          status = tok[i];
          x = parseInt(tok[i + 2], 10);
          y = parseInt(tok[i + 3], 10);
        }
      }
      pins.push({ name, x, y, status });
    }
    void pendingPin;
  }

  const count = cx.length;
  const substrate: Substrate = { dbuPerMicron: dbu, die, rows, tracks, pins };
  return {
    design,
    substrate,
    macros,
    categories,
    placedCells: count,
    unplaced,
    cells: {
      x: Int32Array.from(cx),
      y: Int32Array.from(cy),
      w: Int32Array.from(cw),
      h: Int32Array.from(ch),
      cat: Uint8Array.from(ccat),
      count,
    },
  };
}

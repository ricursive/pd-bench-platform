/** Shared placement data model. Coordinates are integer DBU unless noted. */

export interface DieArea {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Row {
  site: string;
  x: number;
  y: number;
  orient: string;
  numX: number;
  numY: number;
  stepX: number;
  stepY: number;
}

export interface Track {
  axis: "X" | "Y";
  layer: string;
  start: number;
  num: number;
  step: number;
}

export interface Pin {
  name: string;
  x: number;
  y: number;
  status: string;
}

/** The fixed, hard-gated floorplan substrate (identical across all phases). */
export interface Substrate {
  dbuPerMicron: number;
  die: DieArea;
  rows: Row[];
  tracks: Track[];
  pins: Pin[];
}

export interface MacroInst {
  name: string;
  master: string;
  x: number;
  y: number;
  w: number;
  h: number;
  orient: string;
  status: string;
}

/** Std cells stored as parallel typed arrays for compactness at ~100K scale. */
export interface CellArrays {
  x: Int32Array;
  y: Int32Array;
  w: Int32Array;
  h: Int32Array;
  cat: Uint8Array;
  count: number;
}

export interface PlacementPayload {
  design: string;
  substrate: Substrate;
  macros: MacroInst[];
  cells: CellArrays;
  /** master name per category index (cat -> name) */
  categories: string[];
  placedCells: number;
  unplaced: number;
}

export interface MacroSize {
  w: number; // microns
  h: number; // microns
  isBlock: boolean;
}

/** DEF orientations whose bbox swaps width/height (90/270 rotations). */
export const ROTATED_ORIENTS = new Set(["E", "W", "FE", "FW"]);
export const PLACED_STATUSES = new Set(["PLACED", "FIXED", "COVER"]);

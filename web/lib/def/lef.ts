import type { MacroSize } from "./types";

/**
 * Parse MACRO SIZE/CLASS from the LEF subset OpenROAD emits for this task.
 * Returns master name -> {w, h (microns), isBlock}. Not a general LEF reader.
 */
export function parseLefMacros(text: string): Map<string, MacroSize> {
  const macros = new Map<string, MacroSize>();
  let name: string | null = null;
  let w = 0;
  let h = 0;
  let isBlock = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const tok = line.split(/\s+/);

    if (tok[0] === "MACRO") {
      name = tok[1];
      w = 0;
      h = 0;
      isBlock = false;
    } else if (name && tok[0] === "CLASS") {
      isBlock = tok.includes("BLOCK");
    } else if (name && tok[0] === "SIZE") {
      // SIZE <w> BY <h> ;
      const by = tok.indexOf("BY");
      if (by > 1) {
        w = parseFloat(tok[by - 1]);
        h = parseFloat(tok[by + 1]);
      }
    } else if (name && tok[0] === "END" && tok[1] === name) {
      macros.set(name, { w, h, isBlock });
      name = null;
    }
  }
  return macros;
}
